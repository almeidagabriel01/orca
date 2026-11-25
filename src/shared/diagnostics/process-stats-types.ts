import type { HeavyQueuePeer } from './heavy-job-move-types'

export type StatsSummary = {
  totalAgentsSpawned: number
  totalPRsCreated: number
  totalAgentTimeMs: number
  // Sourced from aggregates, not the event log, so it survives event trimming.
  firstEventAt: number | null // timestamp of first-ever event, for "tracking since..."
}

/** cpu is percent of a single core — can exceed 100 on multi-core. memory is in bytes. */
export type UsageValues = {
  cpu: number
  memory: number
  /** Separate committed bytes, never a replacement for memory; absent means unknown, not zero. */
  privateMemory?: number
}

/** `footprint` is macOS phys_footprint (Activity Monitor's Memory): private pages plus GPU memory, shared pages excluded. */
export type ProcessMemoryMetric = 'rss' | 'working-set' | 'footprint'

/** Windows private commit charge (PageFileUsage/Private Bytes) includes paged-out memory, unlike working set.
 * It can reveal paging pressure even as resident memory shrinks. Unix snapshots omit this metric. */
export type ProcessCommitMetric = 'private-bytes'

export type HostAvailableMemorySource = 'memory-pressure' | 'proc-meminfo' | 'free-memory'

/** The top-level cpu/memory are the sum of main + renderer + other. */
export type AppMemory = UsageValues & {
  main: UsageValues
  renderer: UsageValues
  other: UsageValues
  /** Oldest-first memory samples (bytes) for the whole Orca app; empty before the first snapshot. */
  history: number[]
}

export type SessionMemory = UsageValues & {
  sessionId: string
  paneKey: string | null
  pid: number
}

/** A chat agent's process tree (its CLI and the processes running under it), in its workspace. */
export type ChatAgentMemory = Pick<UsageValues, 'cpu' | 'memory'> & {
  agentSessionId: string
  /** Agent id such as `claude`; clients name it. */
  agent: string
  /** The conversation's name; null until it has one. */
  name: string | null
}

/** The top-level cpu/memory are the sum of sessions and chats. */
export type WorktreeMemory = UsageValues & {
  worktreeId: string
  worktreeName: string
  repoId: string
  repoName: string
  sessions: SessionMemory[]
  /** Absent from older hosts. */
  chats?: ChatAgentMemory[]
  /** Oldest-first memory samples (bytes) for this worktree's tracked subtrees. */
  history: number[]
}

export type HostMemory = {
  totalMemory: number
  /** Immediately free memory reported by Node's host API. */
  freeMemory: number
  /** Memory available without material pressure, or freeMemory when unavailable. */
  availableMemory: number
  availableMemorySource: HostAvailableMemorySource
  /** totalMemory - availableMemory. */
  usedMemory: number
  memoryUsagePercent: number
  cpuCoreCount: number
  loadAverage1m: number
  // Whole-machine totals below; absent means unknown (older hosts, unsupported platforms, first sample).
  /** Busy share of all cores since the previous snapshot, 0-100. */
  cpuUsagePercent?: number
  swapTotal?: number
  swapUsed?: number
  /** Volume holding the home directory; used counts reserved blocks, like df's Use%. */
  diskTotal?: number
  diskUsed?: number
  /** 1, 5 and 15 minute load averages; absent on Windows. */
  loadAverage?: number[]
  /** Top groups by CPU and by memory outside Orca's process trees; absent on Windows and older hosts. */
  outsideOrca?: OutsideOrcaProcessGroup[]
  /** The vps-heavy command queue; absent on hosts without one, on Windows and on older hosts. */
  heavyQueue?: HeavyCommandQueue
  /** Heavy process groups the queue did not start, Orca's own app excluded; absent on Windows and older hosts. */
  outsideQueue?: OutsideQueueProcessGroup[]
}

/** Commands waiting for or holding one of the host's vps-heavy slots. */
export type HeavyCommandQueue = {
  /** Host epoch ms of the read; job times compare with it, never with the reader's clock. */
  readAt: number
  slots: number
  /** True when the host can reorder, start, cancel and resize through diagnostics.heavyQueueAction. */
  controls: boolean
  /** True when the host's script can also stop a running job; absent from older hosts. */
  canStop?: boolean
  /** Hostname the host's script reports; absent from older scripts. */
  hostname?: string | null
  /** ssh peers the host's script can move jobs to; absent from older scripts. */
  peers?: HeavyQueuePeer[]
  /** True when the host's script can move a job to a peer (`move-host`). */
  canMoveHost?: boolean
  jobs: HeavyCommandJob[]
}

export type HeavyCommandJob = {
  pid: number
  /** moved: this host's wrapper relays the job running on a peer; it holds no slot. */
  status: 'running' | 'waiting' | 'moved'
  /** null while waiting and in an extra slot. */
  slot: number | null
  /** 1-based place among the waiting; null while running or when the host does not order its queue. */
  position: number | null
  /** Waits in the host's order, so it can move and start now; direct flock users and older waiters cannot. */
  ordered: boolean
  /** Holds the lock through `flock` directly, outside the queue's order. */
  direct: boolean
  /** Started now in a temporary slot beyond the host's slots. */
  extra: boolean
  /** Host epoch ms. */
  queuedAt: number
  /** Host epoch ms; null while waiting and for commands that hold the lock through `flock` directly. */
  startedAt: number | null
  cwd: string
  command: string
  /** The command's argv; absent from older scripts, which cannot move the job. */
  argv?: string[]
  /** The script's group for the job; null when it has none. */
  group?: string | null
  /** Hostname of the host that moved the job here; null for jobs started here. */
  movedFrom?: string | null
  /** The peer now running this job; set on status moved. */
  movedTo?: HeavyJobMovedTo | null
  /** The Orca workspace holding cwd on that host; absent when none does. */
  workspace?: HeavyCommandWorkspace
}

export type HeavyJobMovedTo = { peer: string; alias: string; hostname: string | null }

export type HeavyCommandWorkspace = { worktreeId: string; worktreeName: string; repoName: string }

/** Processes folded by macOS app bundle, Linux container, or command name; cpu is percent of one core. */
export type OutsideOrcaProcessGroup = {
  name: string
  kind: 'app' | 'container' | 'command' | 'kernel'
  cpu: number
  memory: number
  processCount: number
}

/** Processes above the heavy threshold folded by app, container or tool; cpu is percent of one core. */
export type OutsideQueueProcessGroup = {
  /** e.g. "iOS Simulator", "Google Chrome", "node vitest", "xcodebuild", a container name. */
  name: string
  kind: 'app' | 'container' | 'command'
  /** Tool that launched the group when it is another process, e.g. "lighthouse" for Chrome. */
  launcher?: string
  cpu: number
  memory: number
  /** Simulator devices for "iOS Simulator", else processes. */
  count: number
  /** The Orca workspace holding the group's cwd (or its parent's); absent when none does. */
  workspace?: HeavyCommandWorkspace
  /** Last segment of that cwd when no workspace holds it; absent for / and the home directory. */
  folder?: string
}

/** One process under a session; command, cwd and startedAt are null where the host cannot read them. */
export type SessionProcess = {
  pid: number
  ppid: number
  /** Percent of one core. */
  cpu: number
  memory: number
  command: string | null
  cwd: string | null
  /** Host epoch ms; compare with collectedAt, never with the reader's clock. */
  startedAt: number | null
}

/** A session's process tree, read on request from the host's latest sweep. */
export type SessionProcessTree = {
  sessionId: string
  rootPid: number
  collectedAt: number
  processes: SessionProcess[]
}

export type MemorySnapshot = {
  app: AppMemory
  worktrees: WorktreeMemory[]
  /** Every agent process outside terminals, including the chats listed under worktrees; absent from older hosts. */
  agentProcesses?: UsageValues
  host: HostMemory
  /** Per-process byte metric used by app, session, worktree, history, and totalMemory values. */
  processMemoryMetric: ProcessMemoryMetric
  /** Committed-byte metric; absent on older hosts or unsupported captures means unknown, never zero. */
  processCommitMetric?: ProcessCommitMetric
  /** Sum of app + agent processes + all tracked worktree sessions. Percent of a single core, so may exceed 100 on multi-core machines. */
  totalCpu: number
  /** Sum of per-process samples. With rss/working-set, shared pages may repeat, so this can exceed host.totalMemory. */
  totalMemory: number
  /** App, agent-process and tracked-worktree committed bytes, present exactly with processCommitMetric; exceeding physical RAM is meaningful. */
  totalPrivateMemory?: number
  collectedAt: number
  /** Set on a paired reply that carries chats; a host that predates it never sends them. */
  chatsIncluded?: true
}
