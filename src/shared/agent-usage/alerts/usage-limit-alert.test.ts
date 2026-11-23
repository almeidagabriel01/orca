import { describe, expect, it } from 'vitest'
import { decideUsageLimitAlert, parseUsageLimitAlertSlots } from './usage-limit-alert'

const HOUR = 3_600_000
const NOW = 1_000 * HOUR
const RESET = NOW + 48 * HOUR

function step(
  usedPercent: number,
  prior: ReturnType<typeof decideUsageLimitAlert>['next'] | undefined,
  resetsAt: number | null = RESET,
  now = NOW
) {
  return decideUsageLimitAlert({
    window: { usedPercent, resetsAt },
    thresholdLeftPercent: 15,
    prior,
    now
  })
}

describe('decideUsageLimitAlert', () => {
  it('fires once per window, at or below the threshold', () => {
    const above = step(80, undefined)
    expect(above.fire).toBe(false)
    const crossing = step(85, above.next)
    expect(crossing.fire).toBe(true)
    const again = step(90, crossing.next)
    expect(again.fire).toBe(false)
    // A small dip back above the threshold is inside the hysteresis band.
    expect(step(90, step(83, again.next).next).fire).toBe(false)
  })

  it('rearms when a new window starts', () => {
    const fired = step(90, undefined)
    expect(fired.fire).toBe(true)
    expect(step(90, fired.next, RESET + 7 * 24 * HOUR).fire).toBe(true)
    // The fired window's reset passed: the next reading belongs to a new one.
    expect(step(90, fired.next, null, RESET + HOUR).fire).toBe(true)
  })

  it('rearms after recovering past the hysteresis band', () => {
    const fired = step(90, undefined)
    const recovered = step(78, fired.next)
    expect(recovered.fire).toBe(false)
    expect(step(86, recovered.next).fire).toBe(true)
  })

  it('ignores a reading whose window already reset', () => {
    expect(step(95, undefined, NOW - HOUR).fire).toBe(false)
  })

  it('does not refire every pass when the reset time is unknown', () => {
    const fired = step(90, undefined, null)
    expect(fired.fire).toBe(true)
    expect(step(90, fired.next, null, NOW + 365 * 24 * HOUR).fire).toBe(false)
  })
})

describe('parseUsageLimitAlertSlots', () => {
  it('discards invalid JSON and malformed slots', () => {
    expect(parseUsageLimitAlertSlots('{nope')).toEqual({})
    expect(
      parseUsageLimitAlertSlots(
        JSON.stringify({ a: { resetsAt: 5, fired: true }, b: { resetsAt: '5', fired: true } })
      )
    ).toEqual({ a: { resetsAt: 5, fired: true } })
  })
})
