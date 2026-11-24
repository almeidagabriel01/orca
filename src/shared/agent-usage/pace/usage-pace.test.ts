import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USAGE_COLOR_RULE,
  formatPaceDelta,
  getPaceVerdict,
  getUsagePace,
  getUsageSeverity,
  normalizeUsageColorRule
} from './usage-pace'

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

describe('getUsageSeverity', () => {
  const pace = (deltaPoints: number, atResetPercent: number | null) => ({
    elapsed: 0.5,
    deltaPoints,
    projection: atResetPercent === null ? null : { atResetPercent, runsOutAt: null },
    dailyBudgetPercent: null
  })
  const byPace = { mode: 'pace', watchAt: 80, criticalAt: 90 } as const
  const byUse = { mode: 'used', watchAt: 80, criticalAt: 90 } as const
  it('by pace: the bar stays neutral whatever the pace or share; the delta carries color', () => {
    expect(getUsageSeverity(20, pace(-22, 47), byPace)).toBe('calm')
    expect(getUsageSeverity(64, pace(4, 107), byPace)).toBe('calm')
    expect(getUsageSeverity(95, pace(27, 163), byPace)).toBe('calm')
  })
  it('by used share: pace never colors, only the thresholds do', () => {
    expect(getUsageSeverity(58, pace(27, 163), byUse)).toBe('calm')
    expect(getUsageSeverity(85, pace(-5, 90), byUse)).toBe('watch')
    expect(getUsageSeverity(92, pace(-5, 95), byUse)).toBe('critical')
    expect(getUsageSeverity(60, null, { mode: 'used', watchAt: 50, criticalAt: 70 })).toBe('watch')
  })
  it('by pace stays neutral even with no pace to show', () => {
    expect(getUsageSeverity(95, null, byPace)).toBe('calm')
  })
})

describe('normalizeUsageColorRule', () => {
  it('defaults to the used share at 80/90 and rejects thresholds out of order', () => {
    expect(normalizeUsageColorRule(undefined)).toEqual(DEFAULT_USAGE_COLOR_RULE)
    expect(normalizeUsageColorRule({ mode: 'pace', watchAt: 90, criticalAt: 90 })).toEqual({
      mode: 'pace',
      watchAt: 80,
      criticalAt: 90
    })
    expect(normalizeUsageColorRule({ mode: 'used', watchAt: 60, criticalAt: 75 })).toEqual({
      mode: 'used',
      watchAt: 60,
      criticalAt: 75
    })
  })
})
