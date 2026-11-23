import React from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { getProviderDisplayName } from '../../../../../shared/agent-usage/display/usage-provider-windows'
import { shortUsageLabel, usedSections } from './usage-headline-sections'
import { formatResetsInCaption } from './usage-reset-caption'
import { formatUsagePercentageLabel } from './usage-percentage-label'
import { formatPaceSummary, getReadingPace } from './usage-pace-caption'

/** The account's short name and, for the host's selected account, a quiet dot. */
export function AccountChipName({
  label,
  selected
}: {
  label: string
  selected: boolean
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="max-w-24 truncate text-foreground">{label}</span>
      {selected ? (
        <span
          data-usage-selected-account=""
          aria-label={t('components.status-bar.usage.accounts.selected', 'Selected')}
          className="size-1.5 shrink-0 rounded-full bg-foreground/60"
        />
      ) : null}
    </span>
  )
}

export function SelectedAccountBadge(): React.JSX.Element {
  const t = useTranslate()
  return (
    <span
      data-usage-selected-account=""
      className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-muted-foreground"
    >
      {t('components.status-bar.usage.accounts.selected', 'Selected')}
    </span>
  )
}

/** One account's chip: outlined so neighbours read apart, its tooltip spelling out every window. */
export function AccountUsageChip({
  p,
  accountLabel,
  selected,
  display,
  children
}: {
  p: ProviderRateLimits
  accountLabel: string
  selected: boolean
  display: UsagePercentageDisplay
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const names = { provider: getProviderDisplayName(p.provider), account: accountLabel }
  const heading = selected
    ? t(
        'components.status-bar.usage.accounts.chipTitleSelected',
        '{{provider}} · {{account}} (selected)',
        names
      )
    : t('components.status-bar.usage.accounts.chipTitle', '{{provider}} · {{account}}', names)
  // Why read on hover: resets count down live, and a ticking clock per chip would redraw the bar.
  const [now, setNow] = React.useState<number | null>(null)
  const lines = usedSections(p, t).map((section) => {
    const usage = `${shortUsageLabel(p, section, false, t)}: ${formatUsagePercentageLabel(section.window.usedPercent, display, t)}`
    if (now === null) {
      return usage
    }
    const pace = getReadingPace(p, section.window, now)
    return [
      usage,
      formatResetsInCaption(section.window.resetsAt, now, intlLocale, t),
      pace ? formatPaceSummary(pace, display, now, intlLocale, t) : null
    ]
      .filter(Boolean)
      .join(' · ')
  })
  return (
    <span
      data-usage-account-chip=""
      title={[heading, ...lines].join('\n')}
      onPointerEnter={() => setNow(Date.now())}
      className="inline-flex h-[18px] items-center rounded border border-border px-1.5"
    >
      {children}
    </span>
  )
}
