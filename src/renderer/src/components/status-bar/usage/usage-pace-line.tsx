import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { UsagePace } from '../../../../../shared/agent-usage/pace/usage-pace'
import { formatPaceDelta, getPaceVerdict } from '../../../../../shared/agent-usage/pace/usage-pace'
import { cn } from '@/lib/class-names'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { StatusBarUsageSection } from '../composition/status-bar-usage-sections'
import { formatBareUsagePercentage } from './usage-percentage-label'
import { formatLocalizedResetDuration } from './usage-reset-caption'
import {
  clampUsedPercent,
  getDisplayedUsagePercentage
} from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { UsageBar } from './usage-meter'
import {
  formatPaceDetails,
  formatPaceVerdict,
  getReadingPace,
  getWindowSeverity,
  paceTextClass,
  paceTickPercent,
  SEVERITY_FILL_CLASS,
  SEVERITY_TEXT_CLASS
} from './usage-pace-caption'
import { useUsageColorRule } from './use-usage-color-rule'

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
      <span className={inverted ? undefined : paceTextClass(pace)}>{details.verdict}</span>
      {details.extra.map((line) => ` · ${line}`).join('')}
    </div>
  )
}

/** "+27%" beside a window's number: how far spend runs ahead of (+) or behind (−) time. */
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
      className={cn(
        'text-[10px] tabular-nums',
        paceTextClass(pace) || 'text-muted-foreground',
        className
      )}
    >
      {short ? text.charAt(0) : text}
    </span>
  )
}

/**
 * One window on a status bar chip, as t3 lays it out: muted name, number in its severity color,
 * then (wide account chips) a mini bar with the even-pace mark and the session's reset, then the
 * pace delta. A thin rule, not a dot, separates it from the window before.
 */
export function ChipWindow({
  p,
  section,
  divider,
  label,
  display,
  now,
  showLabel,
  wide,
  short,
  compact = false
}: {
  p: ProviderRateLimits
  section: StatusBarUsageSection
  divider: boolean
  label: string
  display: UsagePercentageDisplay
  now: number
  showLabel: boolean
  wide: boolean
  short: boolean
  /** Compact bar: a bold number with a smaller, regular-weight muted unit. */
  compact?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const { window } = section
  const pace = getReadingPace(p, window, now)
  const severity = getWindowSeverity(window, useUsageColorRule())
  const text = formatBareUsagePercentage(window.usedPercent, display, t)
  const value = String(getDisplayedUsagePercentage(window.usedPercent, display))
  const name = showLabel ? <span className="text-muted-foreground">{label}</span> : null
  const reset =
    wide && section.key === 'session'
      ? formatLocalizedResetDuration(window.resetsAt, now, intlLocale)
      : null
  return (
    <>
      {divider ? (
        <span aria-hidden="true" className="mx-0.5 h-3 w-px shrink-0 bg-foreground/15" />
      ) : null}
      <span className="inline-flex items-center gap-1 tabular-nums">
        {section.labelFirst ? name : null}
        <span className={cn(SEVERITY_TEXT_CLASS[severity], compact && 'font-semibold')}>
          {compact ? <CompactPercent text={text} value={value} /> : text}
        </span>
        {section.labelFirst ? null : name}
      </span>
      {wide ? (
        <UsageBar
          usedPercent={clampUsedPercent(window.usedPercent)}
          display={display}
          className="h-[4px] w-7 shrink-0"
          trackClassName="bg-foreground/15"
          fillClassName={SEVERITY_FILL_CLASS[severity]}
          paceTickPercent={paceTickPercent(pace, display)}
        />
      ) : null}
      {reset ? <span className="text-muted-foreground">{reset}</span> : null}
      {pace ? <PaceDelta pace={pace} short={short} /> : null}
    </>
  )
}

function CompactPercent({ text, value }: { text: string; value: string }): React.ReactNode {
  const at = text.indexOf(value)
  if (at === -1) {
    return text
  }
  const unit = (part: string) =>
    part.trim() ? (
      <span className="text-[0.82em] font-normal text-muted-foreground">{part}</span>
    ) : (
      part
    )
  return (
    <>
      {unit(text.slice(0, at))}
      {value}
      {unit(text.slice(at + value.length))}
    </>
  )
}
