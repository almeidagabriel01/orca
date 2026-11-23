import { clampUsedPercent } from '../display/usage-percentage-display'

/** Percent left at or below which a window alerts; null leaves that window silent. */
export const USAGE_LIMIT_ALERT_RULES: Record<UsageLimitAlertWindow, number | null> = {
  weekly: 15,
  session: null
}

export type UsageLimitAlertWindow = 'weekly' | 'session'

/** Per account and window: the window last seen and whether it already alerted. */
export type UsageLimitAlertSlot = { resetsAt: number | null; fired: boolean }

const SAME_WINDOW_TOLERANCE_MS = 10 * 60_000
const REARM_HYSTERESIS_POINTS = 5
const SLOT_RETENTION_MS = 8 * 24 * 60 * 60_000

export function usageLimitLeftPercent(usedPercent: number): number {
  return 100 - clampUsedPercent(usedPercent)
}

export function decideUsageLimitAlert(args: {
  window: { usedPercent: number; resetsAt: number | null }
  thresholdLeftPercent: number
  prior: UsageLimitAlertSlot | undefined
  now: number
}): { fire: boolean; next: UsageLimitAlertSlot } {
  const { thresholdLeftPercent, prior, now } = args
  const { usedPercent, resetsAt: readResetsAt } = args.window
  const left = usageLimitLeftPercent(usedPercent)
  const priorExpired = prior?.resetsAt != null && prior.resetsAt <= now
  const newWindow =
    priorExpired ||
    (prior?.resetsAt != null &&
      readResetsAt != null &&
      Math.abs(prior.resetsAt - readResetsAt) > SAME_WINDOW_TOLERANCE_MS)
  const armed = !prior?.fired || newWindow || left >= thresholdLeftPercent + REARM_HYSTERESIS_POINTS
  // A reading whose window already reset describes spend that no longer limits anything.
  const stale = readResetsAt != null && readResetsAt <= now
  const fire = armed && !stale && left <= thresholdLeftPercent
  // Keep the last known reset so expiry can rearm, but never one that already expired.
  const resetsAt = readResetsAt ?? (priorExpired ? null : (prior?.resetsAt ?? null))
  return { fire, next: { resetsAt, fired: fire || !armed } }
}

/** Drops slots whose window ended long ago, so the store holds only live accounts. */
export function pruneUsageLimitAlertSlots(
  slots: Record<string, UsageLimitAlertSlot>,
  now: number
): Record<string, UsageLimitAlertSlot> {
  return Object.fromEntries(
    Object.entries(slots).filter(
      ([, slot]) => slot.resetsAt === null || slot.resetsAt > now - SLOT_RETENTION_MS
    )
  )
}

/** Reads the persisted slots; anything unreadable starts the store over. */
export function parseUsageLimitAlertSlots(raw: string | null): Record<string, UsageLimitAlertSlot> {
  let parsed: unknown
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  const slots: Record<string, UsageLimitAlertSlot> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (
      value &&
      typeof value === 'object' &&
      'fired' in value &&
      'resetsAt' in value &&
      typeof value.fired === 'boolean' &&
      (value.resetsAt === null || typeof value.resetsAt === 'number')
    ) {
      slots[key] = { resetsAt: value.resetsAt, fired: value.fired }
    }
  }
  return slots
}
