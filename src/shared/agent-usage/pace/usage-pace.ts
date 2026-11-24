import type { RateLimitWindow } from '../rate-limits/rate-limit-types'

/** Drift below this many points reads as "on pace"; formatted deltas round to one decimal. */
export const PACE_TOLERANCE_POINTS = 0.1
/** No projection before 1/15 of the window has passed: early spend says little about the rest. */
const MIN_PROJECTION_ELAPSED = 1 / 15

export type UsagePace = {
  /** Share of the window elapsed when the reading was taken, 0..1. */
  elapsed: number
  /** Used percent minus elapsed percent; positive means spending faster than time passes. */
  deltaPoints: number
  /** Where the reading's spend rate lands by the reset; null this early in the window. */
  projection: { atResetPercent: number; runsOutAt: number | null } | null
  /** Weekly windows only: used share of the budget allowed through today (day index + 1 of 7). */
  dailyBudgetPercent: number | null
}

/**
 * Pace as of the reading itself (`readAt`), so an old reading still compares like with like: its
 * used share against the time that had passed when it was taken. Null without a reset clock, or
 * once the window it describes has reset.
 */
export function getUsagePace(
  window: RateLimitWindow,
  readAt: number,
  now: number
): UsagePace | null {
  const { resetsAt, windowMinutes } = window
  if (resetsAt == null || !Number.isFinite(resetsAt) || resetsAt <= now || !(windowMinutes > 0)) {
    return null
  }
  const length = windowMinutes * 60_000
  const elapsed = Math.min(1, Math.max(0, 1 - (resetsAt - readAt) / length))
  const used = Math.min(100, Math.max(0, window.usedPercent))
  let projection: UsagePace['projection'] = null
  if (elapsed >= MIN_PROJECTION_ELAPSED) {
    const atResetPercent = used / elapsed
    const startedAt = resetsAt - length
    projection = {
      atResetPercent,
      // Why: at this rate 100% lands at elapsed * 100 / used of the window.
      runsOutAt: atResetPercent > 100 ? startedAt + (length * elapsed * 100) / used : null
    }
  }
  const dayIndex = Math.min(6, Math.floor(elapsed * 7))
  return {
    elapsed,
    deltaPoints: used - elapsed * 100,
    projection,
    dailyBudgetPercent: windowMinutes === 10_080 ? used / ((dayIndex + 1) / 7) : null
  }
}

export type PaceVerdict = 'over' | 'under' | 'on'

export function getPaceVerdict(deltaPoints: number): PaceVerdict {
  return deltaPoints >= PACE_TOLERANCE_POINTS
    ? 'over'
    : deltaPoints <= -PACE_TOLERANCE_POINTS
      ? 'under'
      : 'on'
}

/** "8", "0.5": the delta's size, one decimal, trailing .0 dropped. */
export function formatPacePoints(deltaPoints: number): string {
  return String(Math.round(Math.abs(deltaPoints) * 10) / 10)
}

/** "+8%", "−12%", "±0%": the delta on the bar, signed so over pace reads as spending ahead. */
export function formatPaceDelta(deltaPoints: number): string {
  const verdict = getPaceVerdict(deltaPoints)
  return verdict === 'on'
    ? '±0%'
    : `${verdict === 'over' ? '+' : '−'}${formatPacePoints(deltaPoints)}%`
}

export type UsageSeverity = 'calm' | 'watch' | 'critical'

/** Thresholds for a window's bar and number; the pace delta is colored by its sign alone. */
export type UsageColorRule = {
  /** Used % at which a window turns amber. */
  watchAt: number
  /** Used % at which a window turns red; always above `watchAt`. */
  criticalAt: number
}

export type UsageColorSettings = {
  /** Amber/red thresholds for usage bars; absent is 80/90. */
  usageColorRule?: UsageColorRule
}

export const DEFAULT_USAGE_COLOR_RULE: UsageColorRule = { watchAt: 80, criticalAt: 90 }

const isPercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100

/** A stored rule, or the default for anything missing or out of order; a retired `mode` is dropped. */
export function normalizeUsageColorRule(value: unknown): UsageColorRule {
  const raw: Partial<UsageColorRule> = typeof value === 'object' && value !== null ? value : {}
  const { watchAt, criticalAt } = raw
  return isPercent(watchAt) && isPercent(criticalAt) && criticalAt > watchAt
    ? { watchAt, criticalAt }
    : DEFAULT_USAGE_COLOR_RULE
}

/** A window's bar and number by its used share: neutral, amber from `watchAt`, red from `criticalAt`. */
export function getUsageSeverity(usedPercent: number, rule: UsageColorRule): UsageSeverity {
  const used = Math.min(100, Math.max(0, usedPercent))
  return used >= rule.criticalAt ? 'critical' : used >= rule.watchAt ? 'watch' : 'calm'
}
