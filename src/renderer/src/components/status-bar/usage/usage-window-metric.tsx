import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { UsageSection } from './usage-headline-sections'
import { formatLocalizedResetDuration } from './usage-reset-caption'
import { formatScopedUsageTitle } from './usage-percentage-label'
import { UsageBar, UsageValue } from './usage-meter'
import { cn } from '@/lib/class-names'
import {
  getReadingPace,
  getWindowSeverity,
  paceTickPercent,
  SEVERITY_FILL_CLASS,
  SEVERITY_TEXT_CLASS
} from './usage-pace-caption'
import { useUsageColorRule } from './use-usage-color-rule'
import { PaceLine } from './usage-pace-line'

/** One window on a Detailed popover row: label, bar with its pace mark, value, reset, then its pace. */
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
  const severity = getWindowSeverity(p, section.window, now, useUsageColorRule())
  const reset = showReset
    ? formatLocalizedResetDuration(section.window.resetsAt, now, intlLocale)
    : null
  return (
    <div
      data-usage-window={section.label}
      title={formatScopedUsageTitle(p, { ...section, label }, display, t) || undefined}
      className="flex flex-col gap-0.5"
    >
      <span className="flex items-center gap-1.5">
        <span className="w-11 shrink-0 truncate text-[10px] text-muted-foreground">{label}</span>
        <UsageBar
          usedPercent={section.window.usedPercent}
          display={display}
          className="h-[5px] min-w-0 flex-1"
          fillClassName={SEVERITY_FILL_CLASS[severity]}
          paceTickPercent={paceTickPercent(pace, display)}
        />
        <UsageValue
          usedPercent={section.window.usedPercent}
          display={display}
          className={cn(
            'w-9 shrink-0 text-right text-[11px] text-foreground',
            SEVERITY_TEXT_CLASS[severity]
          )}
        />
        {showReset ? (
          <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {reset}
          </span>
        ) : null}
      </span>
      {/* Why always shown: pace is the point of the row, not something to hover for. */}
      {pace ? (
        <PaceLine
          pace={pace}
          display={display}
          now={now}
          usedPercent={section.window.usedPercent}
          mutedClass="pl-[50px] text-[10px] leading-4 text-muted-foreground"
        />
      ) : null}
    </div>
  )
}
