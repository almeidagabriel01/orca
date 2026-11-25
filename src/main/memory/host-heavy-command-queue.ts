import { constants } from 'node:fs'
import { access, readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runProcess } from '@orca/process-host'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../shared/diagnostics/process-stats-types'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../shared/execution-host/execution-host'
import { getFolderWorkspaceWorktreeHostId } from '../../shared/folder-workspaces/folder-workspace-worktree'
import { folderWorkspaceKey } from '../../shared/workspace/identity/workspace-scope'
import { getRepoMainWorktreeId, splitWorktreeIdForFilesystem } from '../../shared/worktree/id'
import { findResolvedWorktreeIdForPath } from '../runtime/workspaces/catalog/runtime-worktree-path-identity'
import { createSlowSample } from './host-machine-totals'
import {
  createProjectGroupNameLookup,
  resolveWorktreeMemoryNames,
  type MemorySnapshotStore
} from './memory-snapshot-buckets'

// macOS installs it as `heavy`; Linux hosts had only `vps-heavy` before the alias.
const SCRIPT_NAMES = ['heavy', 'vps-heavy']
const MAX_JOBS = 200
const SCRIPT_TIMEOUT_MS = 5_000
const SCRIPT_MAX_OUTPUT_BYTES = 1024 * 1024
// Why under the Resource Manager's 2 s poll: each poll re-reads, while process trees and paired clients asking in between share it.
const QUEUE_TTL_MS = 1_500

export type HeavyQueueHost = {
  home: string
  pathEnv: string | undefined
  platform: NodeJS.Platform
  isAlive?: (pid: number) => boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isEpochSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** One row of `vps-heavy ls --json` or one job file, in epoch seconds; null when malformed. */
export function parseHeavyQueueJob(value: unknown): HeavyCommandJob | null {
  if (!isRecord(value)) {
    return null
  }
  const { pid, status, slot, queuedAt, startedAt, cwd, command } = value
  if (
    !isPositiveInteger(pid) ||
    (status !== 'running' && status !== 'waiting') ||
    !isEpochSeconds(queuedAt) ||
    typeof cwd !== 'string' ||
    typeof command !== 'string'
  ) {
    return null
  }
  const running = status === 'running'
  return {
    pid,
    status,
    // The wrapper writes slot 0 while it waits.
    slot: running && isPositiveInteger(slot) ? slot : null,
    position: !running && isPositiveInteger(value.position) ? value.position : null,
    ordered: !running && value.ordered === true,
    direct: value.direct === true,
    extra: running && value.extra === true,
    queuedAt: queuedAt * 1000,
    startedAt: running && isEpochSeconds(startedAt) ? startedAt * 1000 : null,
    cwd,
    command
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: alive, owned by another user.
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

export async function findHeavyQueueScript(
  home: string,
  pathEnv: string | undefined
): Promise<string | null> {
  // Why ~/.local/bin too: a main started by systemd or the desktop may miss the login shell's PATH.
  const dirs = [...(pathEnv ?? '').split(path.delimiter), path.join(home, '.local', 'bin')]
  const absoluteDirs = [...new Set(dirs.filter((entry) => path.isAbsolute(entry)))]
  for (const name of SCRIPT_NAMES) {
    for (const dir of absoluteDirs) {
      const candidate = path.join(dir, name)
      try {
        await access(candidate, constants.X_OK)
        return candidate
      } catch {
        // Not in this directory.
      }
    }
  }
  return null
}

type ScriptListing = { jobs: HeavyCommandJob[]; slots: number | null; controls: boolean }

function parseJobList(value: unknown): HeavyCommandJob[] {
  return Array.isArray(value)
    ? value.slice(0, MAX_JOBS).flatMap((row) => parseHeavyQueueJob(row) ?? [])
    : []
}

/** Version 1 printed a bare job list; version 2 adds its slots and the control subcommands. */
export function parseHeavyQueueListing(value: unknown): ScriptListing | null {
  if (Array.isArray(value)) {
    return { jobs: parseJobList(value), slots: null, controls: false }
  }
  if (!isRecord(value) || typeof value.version !== 'number' || value.version < 2) {
    return null
  }
  return {
    jobs: parseJobList(value.jobs),
    slots: isPositiveInteger(value.slots) ? value.slots : null,
    controls: true
  }
}

/** Scripts from before `stop` existed refuse it; their usage text is the only place that says so. */
export async function scriptSupportsStop(script: string): Promise<boolean> {
  const text = await readFile(script, 'utf8').catch(() => '')
  return /\bheavy stop </.test(text)
}

/** The script's own listing also sees direct `flock` users and drops dead jobs. */
async function readScriptListing(script: string): Promise<ScriptListing | null> {
  const result = await runProcess({
    program: script,
    args: ['ls', '--json'],
    timeoutMs: SCRIPT_TIMEOUT_MS,
    maxOutputBytes: SCRIPT_MAX_OUTPUT_BYTES
  })
  if (result.code !== 0 || result.timedOut) {
    return null
  }
  try {
    return parseHeavyQueueListing(JSON.parse(result.stdout))
  } catch {
    return null
  }
}

/** Reads the job files without deleting any; null when the directory is missing. */
async function readJobFiles(
  dir: string,
  isAlive: (pid: number) => boolean
): Promise<HeavyCommandJob[] | null> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  const jobs = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .slice(0, MAX_JOBS)
      .map(async (name) => {
        try {
          return parseHeavyQueueJob(JSON.parse(await readFile(path.join(dir, name), 'utf8')))
        } catch {
          return null
        }
      })
  )
  return jobs.filter((job): job is HeavyCommandJob => job !== null && isAlive(job.pid))
}

async function readSlots(home: string): Promise<number> {
  const raw = await readFile(path.join(home, '.config', 'vps-heavy', 'slots'), 'utf8').catch(
    () => ''
  )
  // Same rule as the script: one digit 1-9, else one slot.
  return /^[1-9]$/.test(raw.trim()) ? Number(raw.trim()) : 1
}

export function supportsHeavyQueueControls(platform: NodeJS.Platform): boolean {
  return platform === 'linux' || platform === 'darwin'
}

/** Null when the host has no queue: neither the script nor its jobs directory. */
export async function readHeavyCommandQueue({
  home,
  pathEnv,
  platform,
  isAlive = isPidAlive
}: HeavyQueueHost): Promise<HeavyCommandQueue | null> {
  if (platform === 'win32') {
    return null
  }
  const script = await findHeavyQueueScript(home, pathEnv)
  // Why: `ls` deletes jobs it thinks dead; the Linux script reads /proc, so macOS lists only through its `heavy` port.
  const listing =
    script && (platform === 'linux' || (platform === 'darwin' && path.basename(script) === 'heavy'))
      ? await readScriptListing(script)
      : null
  const jobs =
    listing?.jobs ??
    (await readJobFiles(path.join(home, '.cache', 'vps-heavy', 'jobs'), isAlive)) ??
    (script ? [] : null)
  if (jobs === null) {
    return null
  }
  return {
    readAt: Date.now(),
    slots: listing?.slots ?? (await readSlots(home)),
    controls: listing?.controls ?? false,
    canStop: Boolean(listing?.controls && script && (await scriptSupportsStop(script))),
    jobs
  }
}

export const sampleHeavyCommandQueue = createSlowSample(
  () =>
    readHeavyCommandQueue({
      home: os.homedir(),
      pathEnv: process.env.PATH,
      platform: process.platform
    }),
  { ttlMs: QUEUE_TTL_MS, keepLastOnTimeout: true }
)

function listLocalWorkspaceRoots(store: MemorySnapshotStore): { id: string; path: string }[] {
  const roots = new Map<string, string>()
  for (const repo of store.getRepos?.() ?? []) {
    if (getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID) {
      roots.set(getRepoMainWorktreeId(repo), repo.path)
    }
  }
  for (const worktreeId of Object.keys(
    store.getAllWorktreeMetaForHost?.(LOCAL_EXECUTION_HOST_ID) ?? {}
  )) {
    const worktreePath = splitWorktreeIdForFilesystem(worktreeId)?.worktreePath
    if (worktreePath) {
      roots.set(worktreeId, worktreePath)
    }
  }
  for (const folder of store.getFolderWorkspaces?.() ?? []) {
    if (getFolderWorkspaceWorktreeHostId(folder) === LOCAL_EXECUTION_HOST_ID) {
      roots.set(folderWorkspaceKey(folder.id), folder.folderPath)
    }
  }
  return [...roots].map(([id, rootPath]) => ({ id, path: rootPath }))
}

/** Names each job's workspace the way this host names its resource rows. */
export function attributeHeavyQueueWorkspaces(
  queue: HeavyCommandQueue,
  store: MemorySnapshotStore
): HeavyCommandQueue {
  if (queue.jobs.length === 0) {
    return queue
  }
  const roots = listLocalWorkspaceRoots(store)
  const projectGroupName = createProjectGroupNameLookup(store)
  return {
    ...queue,
    jobs: queue.jobs.map((job) => {
      const worktreeId = findResolvedWorktreeIdForPath(roots, job.cwd)
      if (!worktreeId) {
        return job
      }
      const { worktreeName, repoName } = resolveWorktreeMemoryNames(
        worktreeId,
        store,
        projectGroupName
      )
      return { ...job, workspace: { worktreeId, worktreeName, repoName } }
    })
  }
}

/** This host's queue at the Resource Manager's cadence, its jobs named by workspace; null without one. */
export async function collectHeavyCommandQueue(
  store: MemorySnapshotStore
): Promise<HeavyCommandQueue | null> {
  const queue = await sampleHeavyCommandQueue()
  return queue && attributeHeavyQueueWorkspaces(queue, store)
}
