import { describe, expect, it } from 'vitest'
import type { UsageColorRule, UsagePace } from '../../../../../shared/agent-usage/pace/usage-pace'
import { paceTextClass } from './usage-pace-caption'

const pace = (deltaPoints: number): UsagePace => ({
  elapsed: 0.5,
  deltaPoints,
  projection: null,
  dailyBudgetPercent: null
})
const byPace: UsageColorRule = { mode: 'pace', watchAt: 80, criticalAt: 90 }
const byUse: UsageColorRule = { mode: 'used', watchAt: 80, criticalAt: 90 }

describe('paceTextClass', () => {
  it('by pace: red over pace, green under it, neutral on pace, whatever the share', () => {
    expect(paceTextClass(64, pace(19), byPace)).toBe('text-red-700 dark:text-red-400')
    expect(paceTextClass(95, pace(-12), byPace)).toBe('text-emerald-700 dark:text-emerald-400')
    expect(paceTextClass(50, pace(0), byPace)).toBe('')
  })

  it('by used share: the delta follows the limit, not the pace', () => {
    expect(paceTextClass(64, pace(19), byUse)).toBe('')
    expect(paceTextClass(92, pace(-12), byUse)).toBe('text-red-600 dark:text-red-400')
  })
})
