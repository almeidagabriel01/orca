import { describe, expect, it } from 'vitest'
import {
  formatHeavyQueueChip,
  nextHeavyQueueChipReading,
  type HeavyQueueChipReading
} from './heavy-queue-chip-state'

const counts = { slots: 2, running: 1, waiting: 3 }
const ok: HeavyQueueChipReading = { value: { status: 'ok', counts }, misses: 0 }

describe('nextHeavyQueueChipReading', () => {
  it('hides hosts without a queue or on older servers', () => {
    expect(nextHeavyQueueChipReading(ok, { kind: 'counts', counts: null }).value.status).toBe(
      'none'
    )
    expect(nextHeavyQueueChipReading(ok, { kind: 'unsupported' }).value.status).toBe('none')
  })

  it('shows counts', () => {
    expect(nextHeavyQueueChipReading(undefined, { kind: 'counts', counts }).value).toEqual({
      status: 'ok',
      counts
    })
  })

  it('shows offline when the very first answer fails', () => {
    expect(nextHeavyQueueChipReading(undefined, { kind: 'error' }).value.status).toBe('offline')
  })

  it('keeps the last sample on one miss and goes offline on the second', () => {
    const one = nextHeavyQueueChipReading(ok, { kind: 'error' })
    expect(one.value).toEqual(ok.value)
    expect(nextHeavyQueueChipReading(one, { kind: 'error' }).value.status).toBe('offline')
  })

  it('resets the miss streak after an answer', () => {
    const one = nextHeavyQueueChipReading(ok, { kind: 'error' })
    const back = nextHeavyQueueChipReading(one, { kind: 'counts', counts })
    expect(nextHeavyQueueChipReading(back, { kind: 'error' }).value.status).toBe('ok')
  })
})

describe('formatHeavyQueueChip', () => {
  it('prints fill and only shows queued when waiting', () => {
    expect(formatHeavyQueueChip({ slots: 2, running: 0, waiting: 0 })).toEqual({
      fill: '0/2',
      queued: null
    })
    expect(formatHeavyQueueChip({ slots: 2, running: 3, waiting: 4 })).toEqual({
      fill: '3/2',
      queued: '+4'
    })
  })
})
