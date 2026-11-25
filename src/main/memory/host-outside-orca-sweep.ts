import os from 'node:os'
import type { HeavyCommandQueue, HostMemory } from '../../shared/diagnostics/process-stats-types'
import { createWorkspaceForPath } from './host-heavy-command-queue'
import {
  ancestorsOf,
  containerIdOf,
  groupOutsideRows,
  listOutsideRows,
  sampleContainerNames,
  weightOf,
  type ProcessDetail
} from './host-outside-orca-processes'
import { getLocalDaemonPid } from './local-daemon-pid'
import type { MemorySnapshotStore } from './memory-snapshot-buckets'
import type { ProcIndex } from './process-index'
import type { PtyRegistration } from './pty-registry'
import { readProcessDetails } from './session-process-tree'

// Detail reads are per process, so only the heaviest rows and their ancestors are read.
const DETAIL_CPU_FLOOR = 5
const DETAIL_MEMORY_FLOOR = 200 * 1024 ** 2
const MAX_DETAIL_ROWS = 40
const MAX_DETAIL_PIDS = 150
const DETAIL_TTL_MS = 30_000

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

/** What runs outside Orca, heavy work the queue did not start marked; absent when the sweep cannot tell. */
export async function collectHostOutsideProcesses(
  index: ProcIndex,
  store: MemorySnapshotStore,
  heavyQueue: HeavyCommandQueue | null,
  sessions: {
    ptys: readonly PtyRegistration[]
    claimed: ReadonlySet<number>
    agentTrees: readonly { pid: number }[]
  },
  platform: NodeJS.Platform = os.platform()
): Promise<Pick<HostMemory, 'outsideOrca'>> {
  const rows = listOutsideRows(
    index,
    {
      // Electron helpers descend from main; the detached daemon needs its own root.
      appRootPids: [process.pid, getLocalDaemonPid()],
      sessionRootPids: [
        ...sessions.ptys.flatMap((pty) => (pty.pid == null ? [] : [pty.pid])),
        ...sessions.claimed,
        ...sessions.agentTrees.map((tree) => tree.pid)
      ],
      queuePids: heavyQueue?.jobs.map((job) => job.pid) ?? []
    },
    platform
  )
  if (!rows) {
    return {}
  }
  const pids = new Set<number>()
  for (const row of rows
    .filter((r) => r.cpu >= DETAIL_CPU_FLOOR || r.memory >= DETAIL_MEMORY_FLOOR)
    .sort((a, b) => weightOf(b.cpu, b.memory) - weightOf(a.cpu, a.memory))
    .slice(0, MAX_DETAIL_ROWS)) {
    pids.add(row.pid)
    for (const ancestor of ancestorsOf(row, index)) {
      pids.add(ancestor.pid)
    }
  }
  const [details, containerNames] = await Promise.all([
    readCachedDetails([...pids].slice(0, MAX_DETAIL_PIDS), platform),
    rows.some((row) => containerIdOf(row, platform)) ? sampleContainerNames() : null
  ])
  return {
    outsideOrca: groupOutsideRows(rows, details, {
      index,
      platform,
      containerNames,
      workspaceOf: createWorkspaceForPath(store),
      home: os.homedir()
    })
  }
}
