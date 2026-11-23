import os from 'node:os'
import { runProcess } from '@orca/process-host'
import type { OutsideOrcaProcessGroup } from '../../shared/diagnostics/process-stats-types'
import { createSlowSample } from './host-machine-totals'
import { collectSubtree, executableBasename, type ProcIndex, type ProcRow } from './process-index'

// Why both metrics: the renderer re-sorts by CPU or memory, so one ranking would drop the other's leaders.
const TOP_GROUPS_PER_METRIC = 25
const MAX_GROUP_NAME_CHARS = 64
// First match is the outermost bundle, so nested helper apps fold into their app.
const APP_BUNDLE = /\/([^/]+)\.app\//
const CONTAINER_ID = /(?:docker|containerd|libpod|crio|kubepods)\S*?([0-9a-f]{64})/
// Orca's systemd units (serve service, daemon and PTY scopes) keep detached and reparented children.
const ORCA_CGROUP_LEAF = /orca[^/,]*(?:,|$)/i

function isOrcaCgroup(row: ProcRow, platform: NodeJS.Platform): boolean {
  return (
    platform === 'linux' &&
    row.command !== undefined &&
    ORCA_CGROUP_LEAF.test(splitLinuxCommand(row.command).cgroup)
  )
}

/** Rows outside Orca's own process trees; null when the sweep carried no command columns. */
export function listOutsideOrcaRows(
  index: Pick<ProcIndex, 'byPid' | 'childrenOf'>,
  orcaRootPids: Iterable<number | null | undefined>,
  platform: NodeJS.Platform
): ProcRow[] | null {
  const roots = [...orcaRootPids]
  for (const row of index.byPid.values()) {
    if (isOrcaCgroup(row, platform)) {
      roots.push(row.pid)
    }
  }
  const orca = new Set<number>()
  for (const root of roots) {
    if (root != null) {
      for (const pid of collectSubtree(index, root, orca)) {
        orca.add(pid)
      }
    }
  }
  const rows: ProcRow[] = []
  let hasCommands = false
  for (const row of index.byPid.values()) {
    hasCommands ||= row.command !== undefined
    if (row.command !== undefined && !orca.has(row.pid)) {
      rows.push(row)
    }
  }
  return hasCommands ? rows : null
}

function splitLinuxCommand(command: string): { cgroup: string; comm: string } {
  const [cgroup, ...comm] = command.split(/\s+/)
  return { cgroup, comm: comm.join(' ') }
}

export function containerIdOf(row: ProcRow, platform: NodeJS.Platform): string | null {
  return platform === 'linux' && row.command
    ? (CONTAINER_ID.exec(splitLinuxCommand(row.command).cgroup)?.[1] ?? null)
    : null
}

function groupOf(
  row: ProcRow,
  platform: NodeJS.Platform,
  containerNames: ReadonlyMap<string, string> | null
): Pick<OutsideOrcaProcessGroup, 'kind' | 'name'> {
  const command = row.command ?? ''
  if (platform === 'darwin') {
    const bundle = APP_BUNDLE.exec(command)?.[1]
    return bundle
      ? { kind: 'app', name: bundle }
      : { kind: 'command', name: executableBasename(command) ?? '?' }
  }
  if (row.pid === 2 || row.ppid === 2) {
    return { kind: 'kernel', name: 'kernel' }
  }
  const containerId = containerIdOf(row, platform)
  if (containerId) {
    return { kind: 'container', name: containerNames?.get(containerId) ?? containerId.slice(0, 12) }
  }
  return { kind: 'command', name: executableBasename(splitLinuxCommand(command).comm) ?? '?' }
}

/** Folds outside rows into groups and keeps the leaders by CPU and by memory. */
export function groupOutsideOrcaProcesses(
  rows: readonly ProcRow[],
  platform: NodeJS.Platform,
  containerNames: ReadonlyMap<string, string> | null
): OutsideOrcaProcessGroup[] {
  const groups = new Map<string, OutsideOrcaProcessGroup>()
  for (const row of rows) {
    const group = groupOf(row, platform, containerNames)
    const name = group.name.slice(0, MAX_GROUP_NAME_CHARS)
    const key = `${group.kind}:${name}`
    const existing = groups.get(key)
    if (existing) {
      existing.cpu += row.cpu
      existing.memory += row.memory
      existing.processCount++
    } else {
      groups.set(key, { kind: group.kind, name, cpu: row.cpu, memory: row.memory, processCount: 1 })
    }
  }
  const all = [...groups.values()]
  const top = new Set([
    ...[...all].sort((a, b) => b.cpu - a.cpu).slice(0, TOP_GROUPS_PER_METRIC),
    ...[...all].sort((a, b) => b.memory - a.memory).slice(0, TOP_GROUPS_PER_METRIC)
  ])
  return [...top]
}

/** Parses `docker ps --no-trunc --format '{{.ID}} {{.Names}}'`. */
export function parseDockerContainerNames(stdout: string): Map<string, string> {
  const names = new Map<string, string>()
  for (const line of stdout.split('\n')) {
    const match = /^([0-9a-f]{64}) (\S+)$/.exec(line.trim())
    if (match) {
      names.set(match[1], match[2].split(',')[0])
    }
  }
  return names
}

// Why cached: the cgroup carries only the id; one docker call per TTL names every container.
const sampleContainerNames = createSlowSample<Map<string, string>>(async () => {
  const result = await runProcess({
    program: 'docker',
    args: ['ps', '--no-trunc', '--format', '{{.ID}} {{.Names}}'],
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    maxOutputBytes: 256 * 1024,
    timeoutMs: 1_000
  })
  return result.code === 0 && !result.timedOut ? parseDockerContainerNames(result.stdout) : null
})

/** What runs on this host outside Orca; undefined when the sweep could not tell. */
export async function collectOutsideOrcaProcesses(
  index: ProcIndex,
  orcaRootPids: Iterable<number | null | undefined>,
  platform: NodeJS.Platform = os.platform()
): Promise<OutsideOrcaProcessGroup[] | undefined> {
  const rows = listOutsideOrcaRows(index, orcaRootPids, platform)
  if (!rows) {
    return undefined
  }
  const containerNames = rows.some((row) => containerIdOf(row, platform))
    ? await sampleContainerNames()
    : null
  return groupOutsideOrcaProcesses(rows, platform, containerNames)
}
