import React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '../../../store'
import {
  getDisplayedUsagePercentage,
  normalizeUsagePercentageDisplay,
  type UsagePercentageDisplay
} from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { formatBareUsagePercentage } from './usage-percentage-label'
import { usageBarClass, type UsageBarTone } from './usage-health-tone'

/**
 * Track stays neutral; the fill is the displayed %. Only a provider's details card passes
 * tone="health" to color the fill by consumption; everywhere else it stays grey.
 */
export function UsageBar({
  usedPercent,
  display,
  tone = 'plain',
  className,
  trackClassName = 'bg-muted',
  fillClassName,
  paceTickPercent = null
}: {
  usedPercent: number
  display: UsagePercentageDisplay
  tone?: UsageBarTone
  className?: string
  trackClassName?: string
  /** Overrides the tone's fill, for surfaces colored by pace severity. */
  fillClassName?: string
  /** Where even spending would be by now, on the bar's own scale; null hides the tick. */
  paceTickPercent?: number | null
}): React.JSX.Element {
  return (
    <span data-usage-bar className={cn('relative block rounded-full', trackClassName, className)}>
      <span className="absolute inset-0 overflow-hidden rounded-full">
        <span
          className={`block h-full rounded-full transition-[width] duration-200 ease-out ${fillClassName ?? usageBarClass(usedPercent, tone)}`}
          style={{
            width: `${getDisplayedUsagePercentage(usedPercent, display)}%`
          }}
        />
      </span>
      {paceTickPercent === null ? null : (
        // Why past the track: a 1px mark inside a 5px bar vanishes; poking out keeps it readable.
        <span
          aria-hidden="true"
          data-usage-pace-tick=""
          className="absolute -inset-y-px w-px -translate-x-1/2 rounded-full bg-current"
          style={{ left: `${Math.min(100, Math.max(0, paceTickPercent))}%` }}
        />
      )}
    </span>
  )
}

/** Bare "86%" in the surrounding text color; the Used/Left column header names what it counts. */
export function UsageValue({
  usedPercent,
  display,
  className
}: {
  usedPercent: number
  display: UsagePercentageDisplay
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <span className={cn('tabular-nums', className)}>
      {formatBareUsagePercentage(usedPercent, display, t)}
    </span>
  )
}

export function useUsageDisplayLabel(display: UsagePercentageDisplay): string {
  const t = useTranslate()
  return display === 'used'
    ? t('auto.components.status.bar.AccountSwitchList.used', 'Used')
    : t('auto.components.status.bar.AccountSwitchList.left', 'Left')
}

/**
 * "Used ⇅" / "Left ⇅" column header that flips the persisted setting Settings also edits.
 * Inside a menu it must be a menu item: Radix menus swallow Tab, so a plain button is unreachable.
 */
export function UsageDisplayToggle({
  asMenuItem = false
}: {
  asMenuItem?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const display = normalizeUsagePercentageDisplay(useAppStore((s) => s.usagePercentageDisplay))
  const setDisplay = useAppStore((s) => s.setUsagePercentageDisplay)
  const label = useUsageDisplayLabel(display)
  const next: UsagePercentageDisplay = display === 'used' ? 'remaining' : 'used'
  const actionLabel =
    next === 'remaining'
      ? t('auto.components.status.bar.UsageDisplayToggle.showRemaining', 'Show remaining usage')
      : t('auto.components.status.bar.UsageDisplayToggle.showUsed', 'Show used usage')
  const button = (
    <Button
      type="button"
      variant="muted-field-icon"
      size="xs"
      title={actionLabel}
      // Why not aria-label: the accessible name must contain the visible "Used"/"Left" (WCAG 2.5.3).
      aria-description={actionLabel}
      data-usage-display-toggle={display}
      onClick={asMenuItem ? undefined : () => setDisplay(next)}
    >
      {label}
      <ArrowUpDown aria-hidden="true" className="size-3" />
    </Button>
  )
  if (!asMenuItem) {
    return button
  }
  return (
    <DropdownMenuItem
      asChild
      onSelect={(event) => {
        // Why: keep the menu open so the flipped numbers are visible right away.
        event.preventDefault()
        setDisplay(next)
      }}
    >
      {button}
    </DropdownMenuItem>
  )
}
