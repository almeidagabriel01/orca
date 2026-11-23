import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { UsageSection } from './usage-headline-sections'
import { formatLocalizedResetDuration } from './usage-reset-caption'
import { formatScopedUsageTitle } from './usage-percentage-label'
import { UsageBar, UsageValue } from './usage-meter'
import { formatPaceSummary, getReadingPace, paceTickPercent } from './usage-pace-caption'

/** One window on a Detailed popover row: label, bar with its pace mark, value and, for accounts, reset. */
export function UsageWindowMetric({
  p,
  section,
  label,
  display,
  now,
  showReset
}: {
  p: ProviderRateLimits
  section: UsageSection
  label: string
  display: UsagePercentageDisplay
  now: number
  showReset: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const pace = getReadingPace(p, section.window, now)
  const title = [
    formatScopedUsageTitle(p, { ...section, label }, display, t),
    pace ? formatPaceSummary(pace, display, now, intlLocale, t) : null
  ]
    .filter(Boolean)
    .join('\n')
  const reset = showReset
    ? formatLocalizedResetDuration(section.window.resetsAt, now, intlLocale)
    : null
  return (
    <span
      data-usage-window={section.label}
      title={title || undefined}
      className="flex shrink-0 items-center gap-1.5"
    >
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <UsageBar
        usedPercent={section.window.usedPercent}
        display={display}
        className="h-[5px] w-7"
        paceTickPercent={paceTickPercent(pace, display)}
      />
      <UsageValue
        usedPercent={section.window.usedPercent}
        display={display}
        className="text-[11px]"
      />
      {reset ? <span className="text-[10px] text-muted-foreground">{reset}</span> : null}
    </span>
  )
}
