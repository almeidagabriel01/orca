import { clampUsedPercent } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import {
  getUsageSeverity,
  type UsageColorRule
} from '../../../../../shared/agent-usage/pace/usage-pace'
import { SEVERITY_FILL_CLASS } from './usage-pace-caption'

/** Used % at which usage turns yellow (20% or less left). */
export const USAGE_WARNING_PERCENT = 80
/** Used % at which usage turns red (10% or less left). */
export const USAGE_URGENT_PERCENT = 90

export type UsageHealthTone = 'healthy' | 'warning' | 'urgent'

/** Tone always follows consumption, whichever percentage the user chose to display. */
export function getUsageHealthTone(usedPercent: number): UsageHealthTone {
  const used = clampUsedPercent(usedPercent)
  if (used >= USAGE_URGENT_PERCENT) {
    return 'urgent'
  }
  if (used >= USAGE_WARNING_PERCENT) {
    return 'warning'
  }
  return 'healthy'
}

/** A bar's fill under the user's limits: the same tokens as its number (see usage-pace-caption). */
export function usageBarClass(usedPercent: number, rule: UsageColorRule): string {
  return SEVERITY_FILL_CLASS[getUsageSeverity(usedPercent, rule)]
}
