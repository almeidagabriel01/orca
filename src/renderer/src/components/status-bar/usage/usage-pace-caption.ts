import type { Translate } from '@/i18n/use-translate'
import { uiDateTimeFormat } from '@/i18n/ui-intl-formatters'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import {
  getDisplayedUsagePercentage,
  type UsagePercentageDisplay
} from '../../../../../shared/agent-usage/display/usage-percentage-display'
import {
  formatPacePoints,
  getPaceVerdict,
  getUsagePace,
  getUsageSeverity,
  type PaceVerdict,
  type UsageColorRule,
  type UsageSeverity,
  type UsagePace
} from '../../../../../shared/agent-usage/pace/usage-pace'

/** Pace of a window as `p` last read it; null for readings that never succeeded. */
export function getReadingPace(
  p: ProviderRateLimits,
  window: RateLimitWindow,
  now: number
): UsagePace | null {
  return p.updatedAt > 0 ? getUsagePace(window, p.updatedAt, now) : null
}

/** Where the "even pace" tick sits on a bar that fills with the displayed share. */
export function paceTickPercent(
  pace: UsagePace | null,
  display: UsagePercentageDisplay
): number | null {
  return pace ? getDisplayedUsagePercentage(pace.elapsed * 100, display) : null
}

/** Number and verdict color per severity; calm keeps the surrounding text color. */
export const SEVERITY_TEXT_CLASS: Record<UsageSeverity, string> = {
  calm: '',
  watch: 'text-yellow-700 dark:text-yellow-400',
  critical: 'text-red-600 dark:text-red-400'
}

/** Bar fill per severity; calm stays neutral so color only ever means "look here". */
export const SEVERITY_FILL_CLASS: Record<UsageSeverity, string> = {
  calm: 'bg-muted-foreground/50',
  // Why 600 in light: yellow-500 barely separates from the light track.
  watch: 'bg-yellow-600 dark:bg-yellow-500',
  critical: 'bg-red-500'
}

/**
 * Delta and verdict color: the severity's; by pace, running behind it also reads soft green.
 * By used share, pace stays neutral so color only ever means the real limit.
 */
export function paceTextClass(usedPercent: number, pace: UsagePace, rule: UsageColorRule): string {
  const severity = getUsageSeverity(usedPercent, pace, rule)
  return rule.mode === 'pace' && severity === 'calm' && getPaceVerdict(pace.deltaPoints) === 'under'
    ? 'text-emerald-600 dark:text-emerald-400'
    : SEVERITY_TEXT_CLASS[severity]
}

/** The one severity a window's bar, number, delta and verdict all share. */
export function getWindowSeverity(
  p: ProviderRateLimits,
  window: RateLimitWindow,
  now: number,
  rule: UsageColorRule
): UsageSeverity {
  return getUsageSeverity(window.usedPercent, getReadingPace(p, window, now), rule)
}

export function formatPaceVerdict(pace: UsagePace, t: Translate): string {
  const points = formatPacePoints(pace.deltaPoints)
  switch (getPaceVerdict(pace.deltaPoints)) {
    case 'over':
      return t('components.status-bar.usage.pace.over', '{{points}}% over pace', { points })
    case 'under':
      return t('components.status-bar.usage.pace.under', '{{points}}% under pace', { points })
    case 'on':
      return t('components.status-bar.usage.pace.on', 'On pace')
  }
}

/** "Runs out Thu 14:05" or "≈60% left at reset", in the display the user chose. */
export function formatPaceProjection(
  pace: UsagePace,
  display: UsagePercentageDisplay,
  now: number,
  intlLocale: string,
  t: Translate
): string | null {
  const { projection } = pace
  if (!projection) {
    return null
  }
  if (projection.runsOutAt !== null) {
    const sameDay = projection.runsOutAt - now < 20 * 3_600_000
    const when = uiDateTimeFormat(
      sameDay
        ? { hour: 'numeric', minute: '2-digit' }
        : { weekday: 'short', hour: 'numeric', minute: '2-digit' },
      intlLocale
    ).format(projection.runsOutAt)
    return t('components.status-bar.usage.pace.runsOut', 'Runs out {{when}}', { when })
  }
  const value = String(getDisplayedUsagePercentage(projection.atResetPercent, display))
  return display === 'used'
    ? t('components.status-bar.usage.pace.usedAtReset', '≈{{value}}% used at reset', { value })
    : t('components.status-bar.usage.pace.leftAtReset', '≈{{value}}% left at reset', { value })
}

/** One line for a tooltip: "Expected 40% · 8% over pace · Runs out Thu 14:05". */
export function formatPaceSummary(
  pace: UsagePace,
  display: UsagePercentageDisplay,
  now: number,
  intlLocale: string,
  t: Translate
): string {
  const details = formatPaceDetails(pace, display, now, intlLocale, t)
  return [details.expected, details.verdict, ...details.extra].join(' · ')
}

/** Every pace fact for a window's details: expected share, verdict, projection, daily budget. */
export function formatPaceDetails(
  pace: UsagePace,
  display: UsagePercentageDisplay,
  now: number,
  intlLocale: string,
  t: Translate
): { expected: string; verdict: string; tone: PaceVerdict; extra: string[] } {
  const extra = [formatPaceProjection(pace, display, now, intlLocale, t)]
  if (pace.dailyBudgetPercent !== null) {
    extra.push(
      t('components.status-bar.usage.pace.dailyBudget', 'Today {{value}}% of the daily budget', {
        value: String(Math.round(pace.dailyBudgetPercent))
      })
    )
  }
  return {
    expected: t('components.status-bar.usage.pace.expected', 'Expected {{value}}%', {
      value: String(getDisplayedUsagePercentage(pace.elapsed * 100, display))
    }),
    verdict: formatPaceVerdict(pace, t),
    tone: getPaceVerdict(pace.deltaPoints),
    extra: extra.filter((line): line is string => line !== null)
  }
}
