import { describe, expect, it } from 'vitest'
import type { HeavyCommandJob } from '../../shared/diagnostics/process-stats-types'
import { toHeavyQueueCounts } from './host-heavy-queue-counts'

const job = (pid: number, status: HeavyCommandJob['status']): HeavyCommandJob =>
  ({ pid, status }) as HeavyCommandJob

describe('toHeavyQueueCounts', () => {
  it('is null for a host without a queue', () => {
    expect(toHeavyQueueCounts(null)).toBeNull()
  })

  it('counts running and waiting jobs next to the slots', () => {
    const jobs = [job(1, 'running'), job(2, 'running'), job(3, 'waiting')]
    expect(toHeavyQueueCounts({ readAt: 0, slots: 3, controls: false, jobs })).toEqual({
      slots: 3,
      running: 2,
      waiting: 1
    })
  })
})
