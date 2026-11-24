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

/** One token per signal, in t3code's tones; the number and its bar both read it. */
const TONE = {
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-700 dark:text-red-400',
  green: 'text-emerald-700 dark:text-emerald-400'
} as const

// Why semibold: thin glyphs blend into the background and read lighter than the solid bar.
const toneText = (tone: string): string => `${tone} font-semibold`

/** Number color per severity; calm keeps the surrounding text color. */
export const SEVERITY_TEXT_CLASS: Record<UsageSeverity, string> = {
  calm: '',
  watch: toneText(TONE.amber),
  critical: toneText(TONE.red)
}

/**
 * Bar fill per severity: the number's own token through currentColor, so both are one color in
 * light and dark. Calm stays neutral so color only ever means "look here".
 */
export const SEVERITY_FILL_CLASS: Record<UsageSeverity, string> = {
  calm: 'bg-muted-foreground/50',
  watch: `bg-current ${TONE.amber}`,
  critical: `bg-current ${TONE.red}`
}

/** The pace delta's own signal, apart from the thresholds: over pace red, under it green. */
const PACE_VERDICT_TEXT_CLASS: Record<PaceVerdict, string> = {
  over: toneText(TONE.red),
  under: toneText(TONE.green),
  on: ''
}

export const paceTextClass = (pace: UsagePace): string =>
  PACE_VERDICT_TEXT_CLASS[getPaceVerdict(pace.deltaPoints)]

/** The severity a window's bar and number share, by used share only. */
export function getWindowSeverity(window: RateLimitWindow, rule: UsageColorRule): UsageSeverity {
  return getUsageSeverity(window.usedPercent, rule)
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
