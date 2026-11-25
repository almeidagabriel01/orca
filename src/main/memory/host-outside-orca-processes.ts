import path from 'node:path'
import { runProcess } from '@orca/process-host'
import {
  OUTSIDE_HEAVY_CPU_PERCENT,
  OUTSIDE_HEAVY_MEMORY_BYTES,
  type HeavyCommandWorkspace,
  type OutsideOrcaProcessGroup
} from '../../shared/diagnostics/process-stats-types'
import { createSlowSample } from './host-machine-totals'
import { collectSubtree, executableBasename, type ProcIndex, type ProcRow } from './process-index'
import { isInterpreter, scriptLabelOf } from './process-script-label'

export type ProcessDetail = { command: string | null; cwd: string | null }

/** A sweep row outside Orca's app, terminals and agents; queued rows run in a vps-heavy job. */
export type OutsideRow = ProcRow & { queued: boolean }

// Why both metrics: the renderer re-sorts by CPU or memory, so one ranking would drop the other's leaders.
const TOP_GROUPS_PER_METRIC = 25
const MAX_GROUP_NAME_CHARS = 64
const MAX_FOLDER_CHARS = 64
const MAX_ANCESTOR_HOPS = 8
// First match is the outermost bundle, so nested helper apps fold into their app.
const APP_BUNDLE = /\/([^/]+)\.app\//
const CONTAINER_ID = /(?:docker|containerd|libpod|crio|kubepods)\S*?([0-9a-f]{64})/
// Orca's systemd units keep detached and reparented children; PTY scopes hold what users run, the rest is the app.
const ORCA_CGROUP_LEAF = /orca[^/,]*(?:,|$)/i
const ORCA_PTY_CGROUP_LEAF = /orca_pty[^/,]*(?:,|$)/i

export const weightOf = (cpu: number, memory: number): number => cpu / 100 + memory / 1024 ** 3

function subtreesOf(
  index: Pick<ProcIndex, 'byPid' | 'childrenOf'>,
  roots: Iterable<number | null | undefined>,
  stopAt?: ReadonlySet<number>
): Set<number> {
  const pids = new Set<number>()
  for (const root of roots) {
    if (root != null && !stopAt?.has(root)) {
      for (const pid of collectSubtree(index, root, stopAt)) {
        pids.add(pid)
      }
    }
  }
  return pids
}

/** Every row outside Orca's app, terminals and agents, tagged; null when the sweep carried no command columns. */
export function listOutsideRows(
  index: Pick<ProcIndex, 'byPid' | 'childrenOf'>,
  roots: {
    appRootPids: Iterable<number | null | undefined>
    sessionRootPids: Iterable<number>
    queuePids: Iterable<number>
  },
  platform: NodeJS.Platform
): OutsideRow[] | null {
  const appRoots = [...roots.appRootPids]
  const sessionRoots = [...roots.sessionRootPids]
  let hasCommands = false
  for (const row of index.byPid.values()) {
    hasCommands ||= row.command !== undefined
    const cgroup = platform === 'linux' && row.command ? splitLinuxCommand(row.command).cgroup : ''
    if (ORCA_PTY_CGROUP_LEAF.test(cgroup)) {
      sessionRoots.push(row.pid)
    } else if (ORCA_CGROUP_LEAF.test(cgroup)) {
      appRoots.push(row.pid)
    }
  }
  if (!hasCommands) {
    return null
  }
  const session = subtreesOf(index, sessionRoots)
  // Sessions descend from the daemon, so the app's walk stops at them.
  const app = subtreesOf(index, appRoots, session)
  const queued = subtreesOf(index, roots.queuePids)
  const rows: OutsideRow[] = []
  for (const row of index.byPid.values()) {
    if (row.command !== undefined && !app.has(row.pid) && !session.has(row.pid)) {
      rows.push({ ...row, queued: queued.has(row.pid) })
    }
  }
  return rows
}

export function splitLinuxCommand(command: string): { cgroup: string; comm: string } {
  const [cgroup, ...comm] = command.split(/\s+/)
  return { cgroup, comm: comm.join(' ') }
}

export function containerIdOf(row: ProcRow, platform: NodeJS.Platform): string | null {
  return platform === 'linux' && row.command
    ? (CONTAINER_ID.exec(splitLinuxCommand(row.command).cgroup)?.[1] ?? null)
    : null
}

export function groupOf(
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

function isSimulatorComm(comm: string): boolean {
  const base = executableBasename(comm)
  return (
    comm.includes('/CoreSimulator/') ||
    comm.includes('.simruntime/') ||
    base === 'launchd_sim' ||
    base === 'Simulator'
  )
}

export function* ancestorsOf(row: ProcRow, index: Pick<ProcIndex, 'byPid'>): Generator<ProcRow> {
  let current = row
  for (let hop = 0; hop < MAX_ANCESTOR_HOPS; hop++) {
    const parent = current.ppid === current.pid ? undefined : index.byPid.get(current.ppid)
    if (!parent) {
      return
    }
    yield parent
    current = parent
  }
}

export type GroupContext = {
  index: Pick<ProcIndex, 'byPid'>
  platform: NodeJS.Platform
  containerNames: ReadonlyMap<string, string> | null
  workspaceOf: (cwd: string) => HeavyCommandWorkspace | null
  home: string
}

type GroupDraft = OutsideOrcaProcessGroup & {
  unqueued: { cpu: number; memory: number }
  heaviest: { weight: number; cwd: string } | null
}

/** Folds every row into exactly one group; heavy marks what the queue did not start. */
export function groupOutsideRows(
  rows: readonly OutsideRow[],
  details: ReadonlyMap<number, ProcessDetail>,
  ctx: GroupContext
): OutsideOrcaProcessGroup[] {
  const usableCwd = (cwd: string | null | undefined): string | null =>
    cwd && cwd !== '/' && cwd !== ctx.home ? cwd : null
  const groups = new Map<string, GroupDraft>()
  for (const row of rows) {
    const comm =
      ctx.platform === 'linux' ? splitLinuxCommand(row.command ?? '').comm : (row.command ?? '')
    const isSimulator = ctx.platform === 'darwin' && isSimulatorComm(comm)
    const base = isSimulator
      ? { kind: 'app' as const, name: 'iOS Simulator' }
      : groupOf(row, ctx.platform, ctx.containerNames)
    let name = base.name
    const ownLabel = scriptLabelOf(details.get(row.pid)?.command ?? '')
    if (base.kind === 'command' && ownLabel && isInterpreter(name)) {
      name = `${name} ${ownLabel}`
    }
    let launcher: string | undefined
    let cwd = usableCwd(details.get(row.pid)?.cwd)
    for (const ancestor of base.kind === 'kernel' ? [] : ancestorsOf(row, ctx.index)) {
      const detail = details.get(ancestor.pid)
      cwd ??= usableCwd(detail?.cwd)
      if (launcher === undefined) {
        const label = scriptLabelOf(detail?.command ?? '')
        if (label) {
          // Empty marks "found, same as the group", which ends the search.
          launcher = label === ownLabel || label === base.name ? '' : label
        }
      }
      if (cwd && launcher !== undefined) {
        break
      }
    }
    name = name.slice(0, MAX_GROUP_NAME_CHARS)
    const key = `${base.kind}\0${name}\0${launcher ?? ''}`
    const group: GroupDraft = groups.get(key) ?? {
      name,
      kind: base.kind,
      ...(launcher ? { launcher } : {}),
      cpu: 0,
      memory: 0,
      processCount: 0,
      unqueued: { cpu: 0, memory: 0 },
      heaviest: null
    }
    groups.set(key, group)
    group.cpu += row.cpu
    group.memory += row.memory
    group.processCount++
    // One launchd_sim per booted device.
    if (isSimulator && executableBasename(comm) === 'launchd_sim') {
      group.devices = (group.devices ?? 0) + 1
    }
    if (!row.queued) {
      group.unqueued.cpu += row.cpu
      group.unqueued.memory += row.memory
      const weight = weightOf(row.cpu, row.memory)
      if (cwd && (!group.heaviest || weight > group.heaviest.weight)) {
        group.heaviest = { weight, cwd }
      }
    }
  }
  const isHeavy = (g: GroupDraft): boolean =>
    g.kind !== 'kernel' &&
    (g.unqueued.cpu >= OUTSIDE_HEAVY_CPU_PERCENT || g.unqueued.memory >= OUTSIDE_HEAVY_MEMORY_BYTES)
  const heavy = new Set([...groups.values()].filter(isHeavy))
  const all = [...groups.values()]
  const kept = new Set([
    ...[...all].sort((a, b) => b.cpu - a.cpu).slice(0, TOP_GROUPS_PER_METRIC),
    ...[...all].sort((a, b) => b.memory - a.memory).slice(0, TOP_GROUPS_PER_METRIC),
    ...heavy
  ])
  return [...kept].map((draft) => {
    const { unqueued: _unqueued, heaviest, ...group } = draft
    if (!heavy.has(draft)) {
      return group
    }
    const workspace = heaviest ? ctx.workspaceOf(heaviest.cwd) : null
    const folder = heaviest ? path.basename(heaviest.cwd).slice(0, MAX_FOLDER_CHARS) : ''
    return {
      ...group,
      heavy: true,
      ...(workspace ? { workspace } : folder ? { folder } : {})
    }
  })
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
export const sampleContainerNames = createSlowSample<Map<string, string>>(async () => {
  const result = await runProcess({
    program: 'docker',
    args: ['ps', '--no-trunc', '--format', '{{.ID}} {{.Names}}'],
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    maxOutputBytes: 256 * 1024,
    timeoutMs: 1_000
  })
  return result.code === 0 && !result.timedOut ? parseDockerContainerNames(result.stdout) : null
})
