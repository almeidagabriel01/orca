import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'

export type HeavyQueueRow = {
  job: HeavyCommandJob
  /** Time running, or waiting, against the host's own clock. */
  elapsedMs: number
  /** Running with no recorded start, so elapsed counts from when it asked for a slot. */
  elapsedFromQueue: boolean
  /** 1-based place in line; null while running. */
  position: number | null
  /** One-line name: project · workspace, from the Orca workspace or the cwd's meaningful segments. */
  place: string
  /** What the host lets this row do; all false without controls. */
  can: {
    /** In the host's order, so it drags, reorders and starts now. */
    startNow: boolean
    remove: boolean
    /** Ends a running job; only hosts whose script has `stop`. */
    stop: boolean
  }
}

export type HeavyQueueView = {
  slots: number
  /** Slots in use; extra slots are counted apart. */
  busy: number
  extra: number
  controls: boolean
  running: HeavyQueueRow[]
  /** Relayed to a peer: no slot here, only stop. */
  moved: HeavyQueueRow[]
  waiting: HeavyQueueRow[]
}

const NO_ACTIONS: HeavyQueueRow['can'] = {
  startNow: false,
  remove: false,
  stop: false
}

const HOME_PREFIX = /^\/(?:home|Users)\/[^/]+(?=\/|$)/

function placeOf(job: HeavyCommandJob): string {
  const workspace = job.workspace
  if (workspace) {
    return workspace.repoName === workspace.worktreeName
      ? workspace.worktreeName
      : `${workspace.repoName} · ${workspace.worktreeName}`
  }
  return cwdName(job.cwd)
}

/** A readable project · workspace for a cwd Orca does not know: agent worktrees and CI runners by their layout. */
export function cwdName(cwd: string): string {
  const parts = cwd.replace(HOME_PREFIX, '').split('/').filter(Boolean)
  const claude = parts.indexOf('.claude')
  if (claude > 0 && parts[claude + 1] === 'worktrees' && parts[claude + 2]) {
    return `${parts[claude - 1]} · ${parts.slice(claude + 2).join('/')}`
  }
  const work = parts.indexOf('_work')
  if (work > 0 && parts[work - 1].startsWith('actions-runner') && parts[work + 2]) {
    return `${parts[work + 2]} · ${parts[work - 1]}`
  }
  return parts.slice(-2).join(' · ') || cwd
}

function byRunningOrder(a: HeavyCommandJob, b: HeavyCommandJob): number {
  return (
    Number(a.extra) - Number(b.extra) ||
    (a.slot ?? Infinity) - (b.slot ?? Infinity) ||
    a.queuedAt - b.queuedAt
  )
}

// Ordered waiters first, then those outside the order (direct flock users), oldest first.
function byWaitingOrder(a: HeavyCommandJob, b: HeavyCommandJob): number {
  return (
    (a.position ?? Infinity) - (b.position ?? Infinity) || a.queuedAt - b.queuedAt || a.pid - b.pid
  )
}

/** Rows and allowed actions for one host's queue, in the order it will run. */
export function buildHeavyQueueView(queue: HeavyCommandQueue): HeavyQueueView {
  const running = queue.jobs.filter((job) => job.status === 'running').sort(byRunningOrder)
  const waiting = queue.jobs.filter((job) => job.status === 'waiting').sort(byWaitingOrder)
  // Only jobs in the host's order move; direct flock users and older waiters take slots on their own.
  const orderable = waiting.filter((job) => queue.controls && job.ordered)
  return {
    slots: queue.slots,
    busy: running.filter((job) => !job.extra).length,
    extra: running.filter((job) => job.extra).length,
    controls: queue.controls,
    running: running.map((job) => ({
      job,
      elapsedMs: Math.max(0, queue.readAt - (job.startedAt ?? job.queuedAt)),
      elapsedFromQueue: job.startedAt === null,
      position: null,
      place: placeOf(job),
      can: { ...NO_ACTIONS, stop: queue.controls && queue.canStop === true }
    })),
    moved: queue.jobs
      .filter((job) => job.status === 'moved')
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .map((job) => ({
        job,
        elapsedMs: Math.max(0, queue.readAt - (job.startedAt ?? job.queuedAt)),
        elapsedFromQueue: false,
        position: null,
        place: placeOf(job),
        can: { ...NO_ACTIONS, stop: queue.controls && queue.canStop === true }
      })),
    waiting: waiting.map((job, index) => {
      return {
        job,
        elapsedMs: Math.max(0, queue.readAt - job.queuedAt),
        elapsedFromQueue: false,
        position: index + 1,
        place: placeOf(job),
        can: {
          startNow: orderable.includes(job),
          remove: queue.controls,
          stop: false
        }
      }
    })
  }
}

export type QueueMove = 'up' | 'down' | 'top' | 'bottom'

/**
 * The fewest script moves (it only knows up/down/top/bottom) taking index `from` to `to`.
 * Never anchored on `bottom`: a job queued since the sample would shift that landing.
 */
export function heavyQueueMoveSteps(from: number, to: number): QueueMove[] {
  const relative: QueueMove[] = Array(Math.abs(to - from)).fill(to < from ? 'up' : 'down')
  const viaTop: QueueMove[] = ['top', ...Array<QueueMove>(to).fill('down')]
  return viaTop.length < relative.length ? viaTop : relative
}

/** The queue with its ordered waiters in `pids` order; jobs not listed keep their place. */
export function withHeavyQueueOrder(
  queue: HeavyCommandQueue,
  pids: readonly number[]
): HeavyCommandQueue {
  return {
    ...queue,
    jobs: queue.jobs.map((job) => {
      const index = pids.indexOf(job.pid)
      return job.status === 'waiting' && job.ordered && index !== -1
        ? { ...job, position: index + 1 }
        : job
    })
  }
}
