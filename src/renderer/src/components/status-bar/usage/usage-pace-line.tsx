import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { UsagePace } from '../../../../../shared/agent-usage/pace/usage-pace'
import { formatPaceDelta, getPaceVerdict } from '../../../../../shared/agent-usage/pace/usage-pace'
import { cn } from '@/lib/class-names'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { clampUsedPercent } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { UsageBar } from './usage-meter'
import {
  formatPaceDetails,
  formatPaceVerdict,
  getReadingPace,
  PACE_TEXT_CLASS,
  paceTickPercent
} from './usage-pace-caption'

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

/** "+27%" beside a window's number: how far spend runs ahead of (red) or behind (green) time. */
export function PaceDelta({
  pace,
  short = false,
  className
}: {
  pace: UsagePace
  /** Narrow bar: the sign alone, the size stays in the verdict the label reads out. */
  short?: boolean
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  const verdict = getPaceVerdict(pace.deltaPoints)
  const text = formatPaceDelta(pace.deltaPoints)
  return (
    <span
      data-usage-pace-delta={verdict}
      aria-label={formatPaceVerdict(pace, t)}
      className={cn('text-[10px] tabular-nums', PACE_TEXT_CLASS[verdict], className)}
    >
      {short ? text.charAt(0) : text}
    </span>
  )
}

/** A chip window's pace: its own mini bar with the even-pace mark (account chips), then the delta. */
export function ChipWindowPace({
  p,
  window,
  now,
  display,
  withBar,
  short
}: {
  p: ProviderRateLimits
  window: RateLimitWindow
  now: number
  display: UsagePercentageDisplay
  withBar: boolean
  short: boolean
}): React.JSX.Element {
  const pace = getReadingPace(p, window, now)
  return (
    <>
      {withBar ? (
        <UsageBar
          usedPercent={clampUsedPercent(window.usedPercent)}
          display={display}
          className="h-[4px] w-6 shrink-0"
          trackClassName="bg-foreground/15"
          paceTickPercent={paceTickPercent(pace, display)}
        />
      ) : null}
      {pace ? <PaceDelta pace={pace} short={short} /> : null}
    </>
  )
}
