import type {
  HeavyCommandQueue,
  HeavyQueueCounts
} from '../../shared/diagnostics/process-stats-types'
import { sampleHeavyCommandQueue } from './host-heavy-command-queue'

export function toHeavyQueueCounts(queue: HeavyCommandQueue | null): HeavyQueueCounts | null {
  if (!queue) {
    return null
  }
  return {
    slots: queue.slots,
    running: queue.jobs.filter((job) => job.status === 'running').length,
    waiting: queue.jobs.filter((job) => job.status === 'waiting').length
  }
}

/** Cheap enough to poll: reuses the cached queue sample, with no workspace attribution. */
export async function readHeavyQueueCounts(): Promise<HeavyQueueCounts | null> {
  return toHeavyQueueCounts(await sampleHeavyCommandQueue())
}
