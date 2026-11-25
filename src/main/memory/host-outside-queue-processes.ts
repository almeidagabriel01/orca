import os from 'node:os'
import path from 'node:path'
import type {
  HeavyCommandQueue,
  HeavyCommandWorkspace,
  HostMemory,
  OutsideQueueProcessGroup
} from '../../shared/diagnostics/process-stats-types'
import { createWorkspaceForPath } from './host-heavy-command-queue'
import {
  collectOutsideOrcaProcesses,
  containerIdOf,
  groupOf,
  sampleContainerNames,
  splitLinuxCommand
} from './host-outside-orca-processes'
import { getLocalDaemonPid } from './local-daemon-pid'
import type { MemorySnapshotStore } from './memory-snapshot-buckets'
import { collectSubtree, executableBasename, type ProcIndex, type ProcRow } from './process-index'
import { isInterpreter, scriptLabelOf } from './process-script-label'
import type { PtyRegistration } from './pty-registry'
import { readProcessDetails } from './session-process-tree'

export { scriptLabelOf } from './process-script-label'

export type ProcessDetail = { command: string | null; cwd: string | null }

export const OUTSIDE_QUEUE_CPU_THRESHOLD = 25
export const OUTSIDE_QUEUE_MEMORY_THRESHOLD = 1024 ** 3
const MAX_GROUPS = 12
const MAX_ANCESTOR_HOPS = 8
const MAX_FOLDER_CHARS = 64
// Detail reads are per process, so only the heaviest rows and their ancestors are read.
const DETAIL_CPU_FLOOR = 5
const DETAIL_MEMORY_FLOOR = 200 * 1024 ** 2
const MAX_DETAIL_ROWS = 40
const MAX_DETAIL_PIDS = 150
const DETAIL_TTL_MS = 30_000
// Only the serve unit and the daemon's scope are the app; PTY scopes hold what users run.
const ORCA_APP_CGROUP_LEAF = /\/orca[^/,]*\.service(?:,|$)|\/orca-daemon[^/,]*\.scope(?:,|$)/i

const weightOf = (cpu: number, memory: number): number => cpu / 100 + memory / 1024 ** 3

/** Rows neither in Orca's own app nor in a queue job's subtree; what runs in Orca terminals stays. */
export function listOutsideQueueRows(input: {
  index: Pick<ProcIndex, 'byPid' | 'childrenOf'>
  orcaRootPids: readonly (number | null | undefined)[]
  sessionRootPids: readonly number[]
  queuePids: readonly number[]
  platform: NodeJS.Platform
}): ProcRow[] {
  const { index, platform } = input
  const orcaRoots = [...input.orcaRootPids]
  if (platform === 'linux') {
    for (const row of index.byPid.values()) {
      if (row.command && ORCA_APP_CGROUP_LEAF.test(splitLinuxCommand(row.command).cgroup)) {
        orcaRoots.push(row.pid)
      }
    }
  }
  const subtrees = (roots: readonly (number | null | undefined)[]): Set<number> => {
    const pids = new Set<number>()
    for (const root of roots) {
      if (root != null) {
        for (const pid of collectSubtree(index, root, pids)) {
          pids.add(pid)
        }
      }
    }
    return pids
  }
  const orca = subtrees(orcaRoots)
  const sessions = subtrees(input.sessionRootPids)
  const queue = subtrees(input.queuePids)
  const rows: ProcRow[] = []
  for (const row of index.byPid.values()) {
    if (
      row.command !== undefined &&
      !queue.has(row.pid) &&
      (!orca.has(row.pid) || sessions.has(row.pid))
    ) {
      rows.push(row)
    }
  }
  return rows
}

type GroupContext = {
  index: Pick<ProcIndex, 'byPid'>
  platform: NodeJS.Platform
  containerNames: ReadonlyMap<string, string> | null
  workspaceOf: (cwd: string) => HeavyCommandWorkspace | null
  home: string
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

function* ancestorsOf(row: ProcRow, index: Pick<ProcIndex, 'byPid'>): Generator<ProcRow> {
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

type GroupDraft = OutsideQueueProcessGroup & {
  simulators: number
  heaviest: { weight: number; cwd: string } | null
}

/** Folds rows into groups, keeps the heavy ones, heaviest first. */
export function groupOutsideQueueRows(
  rows: readonly ProcRow[],
  details: ReadonlyMap<number, ProcessDetail>,
  ctx: GroupContext
): OutsideQueueProcessGroup[] {
  const usableCwd = (cwd: string | null | undefined): string | null =>
    cwd && cwd !== '/' && cwd !== ctx.home ? cwd : null
  const groups = new Map<string, GroupDraft>()
  for (const row of rows) {
    if (ctx.platform === 'linux' && (row.pid === 2 || row.ppid === 2)) {
      continue
    }
    const comm =
      ctx.platform === 'linux' ? splitLinuxCommand(row.command ?? '').comm : (row.command ?? '')
    const isSimulator = ctx.platform === 'darwin' && isSimulatorComm(comm)
    const base = isSimulator
      ? { kind: 'app' as const, name: 'iOS Simulator' }
      : groupOf(row, ctx.platform, ctx.containerNames)
    if (base.kind === 'kernel') {
      continue
    }
    let { name } = base
    const ownLabel = scriptLabelOf(details.get(row.pid)?.command ?? '')
    if (base.kind === 'command' && ownLabel && isInterpreter(name)) {
      name = `${name} ${ownLabel}`
    }
    let launcher: string | undefined
    let cwd = usableCwd(details.get(row.pid)?.cwd)
    for (const ancestor of ancestorsOf(row, ctx.index)) {
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
    const key = `${base.kind}\0${name}\0${launcher ?? ''}`
    const group: GroupDraft = groups.get(key) ?? {
      name,
      kind: base.kind,
      ...(launcher ? { launcher } : {}),
      cpu: 0,
      memory: 0,
      count: 0,
      simulators: 0,
      heaviest: null
    }
    groups.set(key, group)
    group.cpu += row.cpu
    group.memory += row.memory
    group.count++
    if (isSimulator && executableBasename(comm) === 'launchd_sim') {
      group.simulators++
    }
    const weight = weightOf(row.cpu, row.memory)
    if (cwd && (!group.heaviest || weight > group.heaviest.weight)) {
      group.heaviest = { weight, cwd }
    }
  }
  return [...groups.values()]
    .filter(
      (g) => g.cpu >= OUTSIDE_QUEUE_CPU_THRESHOLD || g.memory >= OUTSIDE_QUEUE_MEMORY_THRESHOLD
    )
    .sort((a, b) => weightOf(b.cpu, b.memory) - weightOf(a.cpu, a.memory))
    .slice(0, MAX_GROUPS)
    .map(({ simulators, heaviest, ...group }) => {
      if (group.name === 'iOS Simulator' && group.kind === 'app') {
        group.count = Math.max(1, simulators)
      }
      const workspace = heaviest ? ctx.workspaceOf(heaviest.cwd) : null
      if (workspace) {
        return { ...group, workspace }
      }
      const folder = heaviest ? path.basename(heaviest.cwd).slice(0, MAX_FOLDER_CHARS) : ''
      return folder ? { ...group, folder } : group
    })
}

// ponytail: keyed by pid alone, so a pid reused within the TTL shows the old label until it expires.
const detailCache = new Map<number, { at: number; detail: ProcessDetail | null }>()

async function readCachedDetails(
  pids: readonly number[],
  platform: NodeJS.Platform
): Promise<Map<number, ProcessDetail>> {
  const now = Date.now()
  for (const [pid, entry] of detailCache) {
    if (now - entry.at >= DETAIL_TTL_MS) {
      detailCache.delete(pid)
    }
  }
  const missing = pids.filter((pid) => !detailCache.has(pid))
  if (missing.length > 0) {
    const read = await readProcessDetails(missing, platform).catch(() => new Map())
    for (const pid of missing) {
      const detail = read.get(pid)
      // Misses are cached too, so an exited or unreadable pid is not re-read every sweep.
      detailCache.set(pid, {
        at: now,
        detail: detail ? { command: detail.command, cwd: detail.cwd } : null
      })
    }
  }
  const details = new Map<number, ProcessDetail>()
  for (const pid of pids) {
    const detail = detailCache.get(pid)?.detail
    if (detail) {
      details.set(pid, detail)
    }
  }
  return details
}

/** Heavy groups this host runs outside the vps-heavy queue and Orca's app; undefined when it cannot tell. */
export async function collectOutsideQueueProcesses(
  index: ProcIndex,
  roots: {
    orcaRootPids: readonly (number | null | undefined)[]
    sessionRootPids: readonly number[]
    queuePids: readonly number[]
  },
  store: MemorySnapshotStore,
  platform: NodeJS.Platform = os.platform()
): Promise<OutsideQueueProcessGroup[] | undefined> {
  if (platform === 'win32') {
    return undefined
  }
  let hasCommands = false
  for (const row of index.byPid.values()) {
    if (row.command !== undefined) {
      hasCommands = true
      break
    }
  }
  if (!hasCommands) {
    return undefined
  }
  const rows = listOutsideQueueRows({ index, ...roots, platform })
  const heavyish = rows
    .filter((row) => row.cpu >= DETAIL_CPU_FLOOR || row.memory >= DETAIL_MEMORY_FLOOR)
    .sort((a, b) => weightOf(b.cpu, b.memory) - weightOf(a.cpu, a.memory))
    .slice(0, MAX_DETAIL_ROWS)
  const pids = new Set<number>()
  for (const row of heavyish) {
    pids.add(row.pid)
    for (const ancestor of ancestorsOf(row, index)) {
      pids.add(ancestor.pid)
    }
  }
  const [details, containerNames] = await Promise.all([
    readCachedDetails([...pids].slice(0, MAX_DETAIL_PIDS), platform),
    rows.some((row) => containerIdOf(row, platform)) ? sampleContainerNames() : null
  ])
  return groupOutsideQueueRows(rows, details, {
    index,
    platform,
    containerNames,
    workspaceOf: createWorkspaceForPath(store),
    home: os.homedir()
  })
}

/** One sweep's two outside views: what runs outside Orca, and heavy work outside the queue. */
export async function collectHostOutsideProcesses(
  index: ProcIndex,
  store: MemorySnapshotStore,
  heavyQueue: HeavyCommandQueue | null,
  sessions: {
    ptys: readonly PtyRegistration[]
    claimed: ReadonlySet<number>
    agentTrees: readonly { pid: number }[]
  }
): Promise<Pick<HostMemory, 'outsideOrca' | 'outsideQueue'>> {
  const daemonPid = getLocalDaemonPid()
  const ptyPids = sessions.ptys.flatMap((pty) => (pty.pid == null ? [] : [pty.pid]))
  const [outsideOrca, outsideQueue] = await Promise.all([
    // Electron helpers descend from main; the detached daemon, systemd-scoped PTYs and claimed agent rows need their own roots.
    collectOutsideOrcaProcesses(index, [process.pid, daemonPid, ...ptyPids, ...sessions.claimed]),
    // Terminal and agent sessions run user work, so only the app itself is left out.
    collectOutsideQueueProcesses(
      index,
      {
        orcaRootPids: [process.pid, daemonPid],
        sessionRootPids: [...ptyPids, ...sessions.agentTrees.map((tree) => tree.pid)],
        queuePids: heavyQueue?.jobs.map((job) => job.pid) ?? []
      },
      store
    ).catch(() => undefined)
  ])
  return { ...(outsideOrca && { outsideOrca }), ...(outsideQueue && { outsideQueue }) }
}
