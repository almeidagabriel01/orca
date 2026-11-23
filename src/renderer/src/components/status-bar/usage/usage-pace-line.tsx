import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { UsagePace } from '../../../../../shared/agent-usage/pace/usage-pace'
import { formatPaceDetails, PACE_TEXT_CLASS } from './usage-pace-caption'

/** "Expected 40% · 8% over pace · Runs out Thu 14:05" under a window's bar. */
export function PaceLine({
  pace,
  display,
  now,
  mutedClass,
  inverted = false
}: {
  pace: UsagePace
  display: UsagePercentageDisplay
  now: number
  mutedClass: string
  /** Tooltips invert the theme, where the tone colors would not read; the words carry it there. */
  inverted?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const details = formatPaceDetails(pace, display, now, intlLocale, t)
  return (
    <div data-usage-pace={details.tone} className={`tabular-nums ${mutedClass}`}>
      {details.expected} ·{' '}
      <span className={inverted ? undefined : PACE_TEXT_CLASS[details.tone]}>
        {details.verdict}
      </span>
      {details.extra.map((line) => ` · ${line}`).join('')}
    </div>
  )
}
