import { describe, expect, it } from 'vitest'
import { formatPaceDelta, getPaceVerdict, getUsagePace } from './usage-pace'

const HOUR = 3_600_000
const week = (usedPercent: number, resetsAt: number) => ({
  usedPercent,
  windowMinutes: 10_080,
  resetsAt,
  resetDescription: null
})

describe('getUsagePace', () => {
  it('compares spend with the time elapsed when the reading was taken', () => {
    // Half of a 5h window gone, 60% used: 10 points over pace, out before the reset.
    const now = 10 * HOUR
    const pace = getUsagePace(
      { usedPercent: 60, windowMinutes: 300, resetsAt: now + 2.5 * HOUR, resetDescription: null },
      now,
      now
    )!
    expect(pace.elapsed).toBeCloseTo(0.5)
    expect(pace.deltaPoints).toBeCloseTo(10)
    expect(pace.projection!.atResetPercent).toBeCloseTo(120)
    // 100% lands at 0.5 * 100 / 60 of the window: 2h30 * 5/3 after the start.
    expect(pace.projection!.runsOutAt).toBeCloseTo(now - 2.5 * HOUR + (5 * HOUR * 0.5 * 100) / 60)
    expect(pace.dailyBudgetPercent).toBeNull()
    expect(getPaceVerdict(pace.deltaPoints)).toBe('over')
  })

  it('judges an old reading at its own time, not at now', () => {
    const readAt = 100 * HOUR
    const resetsAt = readAt + 84 * HOUR // half the week gone at the reading
    const pace = getUsagePace(week(50, resetsAt), readAt, readAt + 20 * HOUR)!
    expect(pace.deltaPoints).toBeCloseTo(0)
    expect(getPaceVerdict(pace.deltaPoints)).toBe('on')
    expect(pace.projection!.runsOutAt).toBeNull()
  })

  it('reads the weekly daily budget from the day the reading falls on', () => {
    const readAt = 1_000 * HOUR
    // 1.5 days into the week: day 2 of 7 allows 2/7 of the limit; 20% used is 70% of it.
    const pace = getUsagePace(week(20, readAt + (168 - 36) * HOUR), readAt, readAt)!
    expect(pace.dailyBudgetPercent).toBeCloseTo(70)
    expect(getPaceVerdict(pace.deltaPoints)).toBe('under')
  })

  it('has no projection this early, and no pace without a clock or after the reset', () => {
    const now = 50 * HOUR
    expect(getUsagePace(week(5, now + 167 * HOUR), now, now)!.projection).toBeNull()
    expect(getUsagePace({ ...week(5, now + HOUR), resetsAt: null }, now, now)).toBeNull()
    expect(getUsagePace(week(5, now - 1), now - HOUR, now)).toBeNull()
  })
})

describe('formatPaceDelta', () => {
  it('signs the delta, one decimal, and reads a dead-even pace as ±0%', () => {
    expect(formatPaceDelta(27.14)).toBe('+27.1%')
    expect(formatPaceDelta(-70)).toBe('−70%')
    expect(formatPaceDelta(0.04)).toBe('±0%')
  })
})
