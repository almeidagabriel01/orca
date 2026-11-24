import { describe, expect, it } from 'vitest'
import type { UsagePace } from '../../../../../shared/agent-usage/pace/usage-pace'
import {
  getWindowSeverity,
  paceTextClass,
  SEVERITY_FILL_CLASS,
  SEVERITY_TEXT_CLASS
} from './usage-pace-caption'

const pace = (deltaPoints: number): UsagePace => ({
  elapsed: 0.5,
  deltaPoints,
  projection: null,
  dailyBudgetPercent: null
})
const window = (usedPercent: number) => ({
  usedPercent,
  windowMinutes: 300,
  resetsAt: null,
  resetDescription: null
})
const rule = { watchAt: 70, criticalAt: 80 }

describe('usage colors: two separate signals', () => {
  it('the pace delta is red over pace and green under it, whatever the share', () => {
    expect(paceTextClass(pace(19))).toBe('text-red-700 dark:text-red-400 font-semibold')
    expect(paceTextClass(pace(-12))).toBe('text-emerald-700 dark:text-emerald-400 font-semibold')
    expect(paceTextClass(pace(0))).toBe('')
  })

  it('the bar and percent follow the limits, not the pace', () => {
    expect(getWindowSeverity(window(40), rule)).toBe('calm')
    expect(getWindowSeverity(window(72), rule)).toBe('watch')
    expect(getWindowSeverity(window(85), rule)).toBe('critical')
  })
})

describe('a colored window', () => {
  it('fills its bar with the exact token of its number, light and dark', () => {
    for (const severity of ['watch', 'critical'] as const) {
      const tone = SEVERITY_TEXT_CLASS[severity].replace(' font-semibold', '')
      expect(SEVERITY_FILL_CLASS[severity]).toBe(`bg-current ${tone}`)
    }
    expect(paceTextClass(pace(19))).toBe(SEVERITY_TEXT_CLASS.critical)
  })
})
