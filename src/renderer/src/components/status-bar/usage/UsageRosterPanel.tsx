import React from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/class-names'
import { useResetCountdownClock } from '@/components/status-bar/usage/useResetCountdownClock'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { ProviderIcon } from './provider-usage-panel'
import { getProviderDisplayName } from '../../../../../shared/agent-usage/display/usage-provider-windows'
import { formatPlanLabel } from './usage-roster-formatting'
import { getUsageRosterRowState, type UsageRosterRowState } from './usage-roster-row-state'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import type { StatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'
import { UsageRowPreferencePickers } from './UsageRowPreferencePickers'
import { sortUsageRosterRows, type UsageRowChip } from '../composition/status-bar-usage-chips'
import { SelectedAccountBadge } from './account-usage-chip'
import {
  getTopScopedSection,
  getUrgentScopedSection,
  getUsageHeadlineSection,
  providerPrimaryMaxUsed,
  windowWordLabel,
  usedSections,
  type UsageSection
} from './usage-headline-sections'
import {
  formatLocalizedResetDuration,
  formatResetsInCaption,
  soonestResetLabel,
  validResetAt
} from './usage-reset-caption'
import { formatBareUsagePercentage, formatScopedUsageTitle } from './usage-percentage-label'
import { getUsageHealthTone } from './usage-health-tone'
import { UsageBar, UsageDisplayToggle, UsageValue } from './usage-meter'
import { getReadingPace, paceTickPercent } from './usage-pace-caption'
import { UsageWindowMetric } from './usage-window-metric'
import { UsageActivityRing, UsageRowSessionCounts } from './usage-agent-sessions-view'
import type { UsageAgentSession } from './usage-account-sessions'

type ProviderId = ProviderRateLimits['provider']
const NO_SESSIONS: readonly UsageAgentSession[] = []

function ScopedUsageFlag({
  p,
  section,
  display
}: {
  p: ProviderRateLimits
  section: UsageSection
  display: UsagePercentageDisplay
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <span
      data-usage-scoped-urgent
      title={formatScopedUsageTitle(p, section, display, t)}
      className="shrink-0 text-[11px] text-muted-foreground"
    >
      {`${section.label} ${formatBareUsagePercentage(section.window.usedPercent, display, t)}`}
    </span>
  )
}

function RowUsageSummary({
  p,
  display,
  now
}: {
  p: ProviderRateLimits
  display: UsagePercentageDisplay
  now: number
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const headline = getUsageHeadlineSection(p, t)
  if (!headline) {
    // Why: a Fable/MCP-only reading is still a reading; show it where the value goes, at any level.
    const only = getTopScopedSection(p, t)
    return (
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {only ? (
          <span
            data-usage-scoped-only
            title={formatScopedUsageTitle(p, only, display, t)}
            className="text-right text-[12px] font-medium tabular-nums"
          >
            <span className="text-[11px] font-normal text-muted-foreground">{only.label}</span>{' '}
            {formatBareUsagePercentage(only.window.usedPercent, display, t)}
          </span>
        ) : (
          <span data-usage-not-checked className="text-[11px] text-muted-foreground">
            {t('auto.components.status.bar.UsageRosterPanel.notChecked', 'Not checked')}
          </span>
        )}
      </span>
    )
  }
  const scoped = getUrgentScopedSection(p, t)
  // Why: a nearly spent headline needs its own reset more than a scoped flag the Detailed line repeats.
  const showScoped = scoped !== null && getUsageHealthTone(headline.window.usedPercent) !== 'urgent'
  const resetsAt = validResetAt(headline.window.resetsAt)
  const resetLabel =
    resetsAt === null
      ? null
      : (formatLocalizedResetDuration(resetsAt, now, intlLocale) ??
        t('auto.components.status.bar.InlineUsageBars.now', 'now'))
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {showScoped && scoped ? (
        <ScopedUsageFlag p={p} section={scoped} display={display} />
      ) : resetLabel ? (
        <span
          data-usage-reset
          aria-label={formatResetsInCaption(resetsAt, now, intlLocale, t) ?? undefined}
          className="text-[11px] text-muted-foreground @max-[340px]:hidden"
        >
          {resetLabel}
        </span>
      ) : null}
      <UsageBar
        usedPercent={headline.window.usedPercent}
        display={display}
        className="h-[5px] w-[30px]"
        paceTickPercent={paceTickPercent(getReadingPace(p, headline.window, now), display)}
      />
      <UsageValue
        usedPercent={headline.window.usedPercent}
        display={display}
        className="w-9 text-right text-[12px] font-medium"
      />
    </span>
  )
}

export function UsageRow({
  p,
  display,
  state,
  showSignInAction,
  now,
  mode = 'verbose',
  accountLabel,
  selected = false,
  sessions = NO_SESSIONS
}: {
  p: ProviderRateLimits
  display: UsagePercentageDisplay
  state: UsageRosterRowState
  showSignInAction: boolean
  now: number
  mode?: StatusBarUsageMode
  /** With 'All accounts': the row is this account's, and each window shows its own reset. */
  accountLabel?: string
  selected?: boolean
  /** The agents billing this row's account, already scoped to it. */
  sessions?: readonly UsageAgentSession[]
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const sections = usedSections(p, t)
  const hasUsage = sections.length > 0
  const name = getProviderDisplayName(p.provider)
  const plan = formatPlanLabel(p.planType)
  // Why: Detailed lists every window below, so a top-right summary would repeat one of them.
  const showDetails = hasUsage && mode === 'verbose'
  const isAccountRow = accountLabel !== undefined
  const soonestReset =
    showDetails && !isAccountRow ? soonestResetLabel(sections, now, intlLocale, t) : null

  return (
    <div data-usage-mode={mode} className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
          <UsageActivityRing sessions={sessions}>
            <ProviderIcon provider={p.provider} />
          </UsageActivityRing>
        </span>
        <span
          className={cn(
            'shrink truncate text-[13px] font-medium text-foreground',
            // Why: a fixed minimum would leave a gap before the reset that follows a short name.
            showDetails ? 'min-w-0' : 'min-w-14'
          )}
        >
          {name}
          {isAccountRow ? <span> · {accountLabel}</span> : null}
          {plan ? <span className="font-normal text-muted-foreground"> · {plan}</span> : null}
        </span>
        {isAccountRow && selected ? <SelectedAccountBadge /> : null}
        {!hasUsage ? (
          <>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {state.statusLabel}
            </span>
            {showSignInAction ? (
              <span className="ml-auto shrink-0 rounded-md border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground">
                {t('auto.components.status.bar.StatusBar.c35af53b73', 'Sign in')}
              </span>
            ) : null}
          </>
        ) : showDetails ? (
          soonestReset ? (
            <span data-usage-reset className="shrink-0 text-[11px] text-muted-foreground">
              {soonestReset}
            </span>
          ) : null
        ) : (
          <RowUsageSummary p={p} display={display} now={now} />
        )}
      </div>
      {state.detail ? (
        <span className="pl-[30px] text-[11px] text-muted-foreground">{state.detail}</span>
      ) : null}
      {showDetails ? (
        <div className="flex flex-col gap-1.5 pl-[30px]">
          {sections.map((section) => {
            return (
              <UsageWindowMetric
                key={section.label}
                p={p}
                section={section}
                label={windowWordLabel(p, section, t)}
                display={display}
                now={now}
                showReset={isAccountRow}
              />
            )
          })}
        </div>
      ) : null}
      <UsageRowSessionCounts sessions={sessions} />
    </div>
  )
}

/** Render one usage row per provider; hosts can wrap rows with account controls or detail menus. */
export function UsageRosterPanel({
  providers,
  accountRows,
  display,
  statusBarUsageMode,
  onStatusBarUsageModeChange,
  usageAccounts,
  onUsageAccountsChange,
  isRefreshing,
  onRefresh,
  onOpenProvider,
  onSignIn,
  canSignIn,
  onManageAccounts,
  onUsageDetails,
  actionsAvailable = true,
  unavailableReason,
  renderRow,
  sessionsForRow
}: {
  providers: ProviderRateLimits[]
  /** With 'All accounts': one row per account, grouped by provider; replaces the provider rows. */
  accountRows?: readonly UsageRowChip[]
  display: UsagePercentageDisplay
  statusBarUsageMode: StatusBarUsageMode
  onStatusBarUsageModeChange: (mode: StatusBarUsageMode) => void
  /** Present where saved accounts could add chips to the row. */
  usageAccounts?: StatusBarUsageAccounts
  onUsageAccountsChange?: (accounts: StatusBarUsageAccounts) => void
  isRefreshing: boolean
  onRefresh: () => void
  onOpenProvider: (provider: ProviderId) => void
  onSignIn: (provider: ProviderId) => void
  canSignIn: (provider: ProviderId) => boolean
  onManageAccounts: () => void
  actionsAvailable?: boolean
  unavailableReason?: string
  onUsageDetails: () => void
  // Return null to use the default row instead of a host-supplied detail/account wrapper.
  renderRow?: (p: ProviderRateLimits, row: React.ReactNode, entry: UsageRowChip) => React.ReactNode
  sessionsForRow?: (entry: UsageRowChip) => readonly UsageAgentSession[]
}): React.JSX.Element {
  const t = useTranslate()
  // Why: one boundary-scheduled clock keeps every open row current without per-provider timers.
  const rows: readonly UsageRowChip[] = accountRows ?? providers.map((p) => ({ id: p.provider, p }))
  const now = useResetCountdownClock(
    rows.flatMap((row) => usedSections(row.p, t).map((section) => section.window.resetsAt))
  )
  const sorted = sortUsageRosterRows(rows, (p) => providerPrimaryMaxUsed(p, t))

  return (
    <div className="@container w-full text-xs">
      <div className="flex items-center justify-between gap-2 pb-2 pl-3.5 pr-[30px] pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <span className="text-[13px] font-semibold text-foreground">
            {t('auto.components.status.bar.UsageRosterPanel.title', 'Usage')}
          </span>
          <span className="truncate text-[11px]">
            · {t('auto.components.status.bar.UsageRosterPanel.allAgents', 'all agents')}
          </span>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              onRefresh()
            }}
            disabled={!actionsAvailable}
            aria-label={t('auto.components.status.bar.StatusBar.3325d996cb', 'Refresh rate limits')}
            className="size-5 justify-center p-0"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          </DropdownMenuItem>
        </div>
        <UsageDisplayToggle asMenuItem />
      </div>
      <UsageRowPreferencePickers
        statusBarUsageMode={statusBarUsageMode}
        onStatusBarUsageModeChange={onStatusBarUsageModeChange}
        {...(usageAccounts && onUsageAccountsChange
          ? { usageAccounts, onUsageAccountsChange }
          : {})}
      />
      {unavailableReason ? (
        <div className="px-3.5 pb-2 text-2xs text-muted-foreground">{unavailableReason}</div>
      ) : null}
      <div className="border-t border-border/70" />
      {sorted.map((entry, index) => {
        const p = entry.p
        const key = entry.id
        // Why: with accounts, a rule between providers keeps each provider's rows together.
        const groupRule =
          accountRows && index > 0 && sorted[index - 1]!.p.provider !== p.provider ? (
            <div className="border-t border-border/50" />
          ) : null
        const state = getUsageRosterRowState(p, usedSections(p, t).length > 0, t)
        const showSignInAction =
          actionsAvailable && state.kind === 'sign-in' && canSignIn(p.provider)
        const rowNode = (
          <UsageRow
            p={p}
            display={display}
            state={state}
            showSignInAction={showSignInAction}
            now={now}
            mode={statusBarUsageMode}
            accountLabel={entry.accountLabel}
            selected={entry.selected}
            sessions={sessionsForRow?.(entry)}
          />
        )
        if (showSignInAction) {
          return (
            <React.Fragment key={key}>
              {groupRule}
              <DropdownMenuItem
                onSelect={() => onSignIn(p.provider)}
                className="w-full cursor-pointer rounded-none px-3.5 py-2.5"
              >
                {rowNode}
              </DropdownMenuItem>
            </React.Fragment>
          )
        }
        const custom = actionsAvailable ? renderRow?.(p, rowNode, entry) : null
        return (
          <React.Fragment key={key}>
            {groupRule}
            {custom ?? (
              <DropdownMenuItem
                disabled={!actionsAvailable}
                onSelect={() => onOpenProvider(p.provider)}
                className="w-full cursor-pointer rounded-none px-3.5 py-2.5"
              >
                {rowNode}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        )
      })}
      <div className="border-t border-border/70" />
      <DropdownMenuItem
        disabled={!actionsAvailable}
        onSelect={onUsageDetails}
        className="w-full cursor-pointer justify-between rounded-none px-3.5 py-2.5 text-[13px] text-foreground"
      >
        {t('auto.components.status.bar.UsageRosterPanel.usageDetails', 'Usage details & history')}
        <ChevronRight size={14} className="text-muted-foreground" />
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!actionsAvailable}
        onSelect={onManageAccounts}
        className="w-full cursor-pointer justify-between rounded-none px-3.5 py-2.5 text-[13px] text-foreground"
      >
        {t('auto.components.status.bar.StatusBar.75ded02687', 'Manage Accounts…')}
        <ChevronRight size={14} className="text-muted-foreground" />
      </DropdownMenuItem>
    </div>
  )
}
