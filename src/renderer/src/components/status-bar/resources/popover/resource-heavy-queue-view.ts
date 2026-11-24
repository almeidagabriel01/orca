import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import { relativeCwd } from './resource-session-processes'

export type HeavyQueueRow = {
  job: HeavyCommandJob
  /** Time running, or waiting, against the host's own clock. */
  elapsedMs: number
  /** Running with no recorded start, so elapsed counts from when it asked for a slot. */
  elapsedFromQueue: boolean
  /** 1-based place in line; null while running. */
  position: number | null
  /** The Orca workspace, else the folder with ~ for home. */
  place: string
  /** What the host lets this row do; all false without controls. */
  can: {
    runNext: boolean
    moveUp: boolean
    moveDown: boolean
    moveToEnd: boolean
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
  waiting: HeavyQueueRow[]
}

const NO_ACTIONS: HeavyQueueRow['can'] = {
  runNext: false,
  moveUp: false,
  moveDown: false,
  moveToEnd: false,
  startNow: false,
  remove: false,
  stop: false
}

function placeOf(job: HeavyCommandJob): string {
  const workspace = job.workspace
  if (!workspace) {
    return relativeCwd(job.cwd, null) ?? job.cwd
  }
  return workspace.repoName === workspace.worktreeName
    ? workspace.worktreeName
    : `${workspace.repoName} / ${workspace.worktreeName}`
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
  const first = orderable[0]
  const last = orderable.at(-1)
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
    waiting: waiting.map((job, index) => {
      const ordered = orderable.includes(job)
      return {
        job,
        elapsedMs: Math.max(0, queue.readAt - job.queuedAt),
        elapsedFromQueue: false,
        position: index + 1,
        place: placeOf(job),
        can: {
          runNext: ordered && job !== first,
          moveUp: ordered && job !== first,
          moveDown: ordered && job !== last,
          moveToEnd: ordered && job !== last,
          startNow: ordered,
          remove: queue.controls,
          stop: false
        }
      }
    })
  }
}
