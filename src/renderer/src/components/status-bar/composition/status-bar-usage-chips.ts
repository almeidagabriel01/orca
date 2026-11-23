import type {
  InactiveAccountUsage,
  ProviderRateLimits
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { StatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../../../shared/agent-accounts/managed-account-types'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { getOwnerInactiveAccounts } from '../accounts/owner-account-rows'
import {
  buildClaudeStatusSwitchGroups,
  getClaudeStatusRuntimeKey,
  normalizeClaudeStatusRuntimeTarget,
  resolveClaudeStatusAccountState
} from '../accounts/status-bar-claude-accounts'
import {
  buildCodexStatusSwitchGroups,
  normalizeCodexStatusRuntimeTarget,
  resolveCodexStatusAccountState
} from '../accounts/status-bar-codex-accounts'
import { claudeRowUsageId, getCodexStatusRuntimeKey } from '../accounts/status-bar-runtime-targets'
import { formatWindowLabel } from '../usage/rate-limit-window-localized-label'
import { USAGE_WARNING_PERCENT } from '../usage/usage-health-tone'
import { clampUsedPercent } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'
import { getStatusBarUsageSections, type StatusBarUsageSection } from './status-bar-usage-sections'
import { getUsageHeadlineSection } from '../usage/usage-headline-sections'

type ProviderId = ProviderRateLimits['provider']

/** One status bar chip and popover row: a provider, or one account of it with 'all'. */
export type UsageRowChip = {
  /** The provider for its selected account's reading; provider and account for another account. */
  id: string
  p: ProviderRateLimits
  /** With 'all', the account's short name; absent when the provider has no accounts to tell apart. */
  accountLabel?: string
  /** The account the owning host has selected for this provider. */
  selected?: boolean
}

/** What an account can be called by, most specific first. */
export type UsageAccountName = {
  displayName?: string | null
  email?: string | null
  organizationName?: string | null
  workspaceLabel?: string | null
}

/** One saved (or System default) account of a provider, as the owning host lists it. */
export type UsageAccountEntry = {
  key: string
  selected: boolean
  /** Its own reading; the selected account always shows the provider's live one. */
  reading: ProviderRateLimits | null
  isFetching?: boolean
  name: UsageAccountName
  /** For a login with no name or email to show, e.g. System default. */
  fallbackLabel?: string
}

/** Short, stable account name: the user's name for it, then the email's local part, then its org. */
export function getUsageAccountLabel(name: UsageAccountName): string | undefined {
  return (
    name.displayName?.trim() ||
    name.email?.trim().split('@')[0] ||
    name.organizationName?.trim() ||
    name.workspaceLabel?.trim() ||
    undefined
  )
}

/** Two accounts sharing a local part (me@a.com, me@b.com) keep the domain's first label. */
function emailWithDomainHead(email: string | null | undefined): string | undefined {
  const [local, domain] = email?.trim().split('@') ?? []
  return local && domain ? `${local}@${domain.split('.')[0]}` : undefined
}

export function resolveUsageAccountLabels(entries: readonly UsageAccountEntry[]): string[] {
  const labels = entries.map(
    (entry) => getUsageAccountLabel(entry.name) ?? entry.fallbackLabel ?? ''
  )
  return labels.map((label, index) => {
    const entry = entries[index]!
    const collides = labels.some((other, otherIndex) => otherIndex !== index && other === label)
    if (!collides || entry.name.displayName?.trim()) {
      return label
    }
    return emailWithDomainHead(entry.name.email) ?? label
  })
}

function unreadReading(provider: ProviderId, isFetching: boolean): ProviderRateLimits {
  // Why unavailable: the chip and row then show dashes rather than a made-up reading.
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status: isFetching ? 'fetching' : 'unavailable'
  }
}

/**
 * The row's chips: one per shown provider, or with 'all' one per account of a provider that lists
 * accounts, its selected account first. Providers without an account list keep one unlabelled chip.
 */
export function buildUsageRowChips(args: {
  providers: readonly ProviderRateLimits[]
  accounts: StatusBarUsageAccounts
  accountsByProvider: Partial<Record<ProviderId, readonly UsageAccountEntry[]>>
}): UsageRowChip[] {
  return args.providers.flatMap((p): UsageRowChip[] => {
    const entries = args.accounts === 'all' ? args.accountsByProvider[p.provider] : undefined
    if (!entries?.length) {
      return [{ id: p.provider, p }]
    }
    const labels = resolveUsageAccountLabels(entries)
    const chips = entries.map((entry, index): UsageRowChip => ({
      id: entry.selected ? p.provider : `${p.provider}:${entry.key}`,
      p: entry.selected
        ? p
        : (entry.reading ?? unreadReading(p.provider, entry.isFetching === true)),
      accountLabel: labels[index],
      selected: entry.selected
    }))
    // Why: the live reading must show even when the host's selection names no listed account.
    if (!chips.some((chip) => chip.selected)) {
      chips.unshift({ id: p.provider, p })
    }
    return chips.sort((a, b) => Number(b.id === p.provider) - Number(a.id === p.provider))
  })
}

/**
 * Popover order: providers by their lead row's primary usage, highest first. Why the lead row: an
 * account group sorts as one, led by the host's selected account, and stays together.
 */
export function sortUsageRosterRows(
  rows: readonly UsageRowChip[],
  primaryUsed: (p: ProviderRateLimits) => number
): UsageRowChip[] {
  const groupUsed = new Map<ProviderId, number>()
  for (const row of rows) {
    if (!groupUsed.has(row.p.provider)) {
      groupUsed.set(row.p.provider, primaryUsed(row.p))
    }
  }
  const used = (row: UsageRowChip) => groupUsed.get(row.p.provider) ?? -1
  return [...rows].sort((a, b) => used(b) - used(a))
}

/** Chip sections for an account chip: fixed window names, so each number says what it measures. */
export function getAccountChipSections(
  p: ProviderRateLimits,
  mode: StatusBarUsageMode,
  t: Translate = translate
): StatusBarUsageSection[] {
  if (!p.session && !p.weekly) {
    return getStatusBarUsageSections(p, mode, t)
  }
  if (mode === 'compact') {
    // Why primary: an unlabelled lone number must be the 5h or weekly one; Fable stays in the tooltip.
    const headline = getUsageHeadlineSection(p, t)
    return headline ? [{ key: 'headline', ...headline }] : []
  }
  const sections: StatusBarUsageSection[] = []
  if (p.session) {
    sections.push({
      key: 'session',
      window: p.session,
      label: formatWindowLabel(p.session.windowMinutes),
      labelFirst: true
    })
  }
  if (p.weekly) {
    sections.push({
      key: 'weekly',
      window: p.weekly,
      label: formatWindowLabel(p.weekly.windowMinutes),
      labelFirst: true
    })
  }
  // Why only when tight: a spent Fable window caps the account even when 5h and weekly are calm.
  if (p.fableWeekly && clampUsedPercent(p.fableWeekly.usedPercent) >= USAGE_WARNING_PERCENT) {
    sections.push({
      key: 'fableWeekly',
      window: p.fableWeekly,
      label: t('auto.components.status.bar.StatusBar.a79c64f87e', 'Fable'),
      labelFirst: true
    })
  }
  return sections
}

const EMPTY_ROSTER = { accounts: [], activeAccountId: null }

/** This device's account snapshots, when loaded; Settings alone still names saved accounts. */
export type LocalUsageAccountRosters = {
  claude?: ClaudeRateLimitAccountsState
  codex?: CodexRateLimitAccountsState
}

function readingFor(
  inactive: readonly InactiveAccountUsage[],
  usageId: string | null
): Pick<UsageAccountEntry, 'reading' | 'isFetching'> {
  const found = usageId ? inactive.find((account) => account.accountId === usageId) : undefined
  return { reading: found?.rateLimits ?? null, isFetching: found?.isFetching === true }
}

function claudeEntries(
  state: ClaudeRateLimitAccountsState,
  ownerUsage: OwnerUsageRateLimits,
  systemDefaultLabel: string
): UsageAccountEntry[] {
  const target = normalizeClaudeStatusRuntimeTarget(state, ownerUsage.rateLimits.claudeTarget)
  const groups = buildClaudeStatusSwitchGroups(state, target)
  const group = groups.find((g) => g.key === getClaudeStatusRuntimeKey(target)) ?? groups[0]
  const inactive = getOwnerInactiveAccounts('claude', ownerUsage)
  return (group?.targets ?? []).flatMap((row): UsageAccountEntry[] => {
    const usage = readingFor(inactive, claudeRowUsageId(row))
    const account = state.accounts.find((saved) => saved.id === row.id)
    // Why: an unused System default login is not an account the user saved.
    if (!row.id && !row.active && !usage.reading) {
      return []
    }
    return [
      {
        key: row.id ?? 'system-default',
        selected: row.active,
        ...usage,
        name: account ?? { email: state.systemDefaultEmail },
        fallbackLabel: systemDefaultLabel
      }
    ]
  })
}

function codexEntries(
  state: CodexRateLimitAccountsState,
  ownerUsage: OwnerUsageRateLimits,
  systemDefaultLabel: string
): UsageAccountEntry[] {
  const target = normalizeCodexStatusRuntimeTarget(state, ownerUsage.rateLimits.codexTarget)
  const groups = buildCodexStatusSwitchGroups(state, target)
  const group = groups.find((g) => g.key === getCodexStatusRuntimeKey(target)) ?? groups[0]
  const inactive = getOwnerInactiveAccounts('codex', ownerUsage)
  return (group?.targets ?? []).flatMap((row): UsageAccountEntry[] => {
    const usage = readingFor(inactive, row.id)
    if (!row.id && !row.active && !usage.reading) {
      return []
    }
    const account = state.accounts.find((saved) => saved.id === row.id)
    return [
      {
        key: row.id ?? 'system-default',
        selected: row.active,
        ...usage,
        name: account ?? { email: state.systemDefault?.email },
        fallbackLabel: systemDefaultLabel
      }
    ]
  })
}

/** The owner's saved accounts per provider; a provider with none keeps its single chip. */
export function getOwnerUsageAccounts(
  ownerUsage: OwnerUsageRateLimits,
  settings: GlobalSettings | null,
  t: Translate = translate,
  localRosters: LocalUsageAccountRosters = {}
): Partial<Record<ProviderId, UsageAccountEntry[]>> {
  const remote = ownerUsage.remoteOwner !== null
  const systemDefaultLabel = t('auto.components.status.bar.StatusBar.c676918adc', 'System default')
  const localCodex: CodexRateLimitAccountsState = localRosters.codex ?? EMPTY_ROSTER
  // Why: a remote owner's roster rides its own accounts snapshot; this device's selection and
  // names live in Settings, and its roster adds what only the host reads (System default's login).
  const claudeState = remote
    ? ownerUsage.accounts?.claude
    : resolveClaudeStatusAccountState(settings, localRosters.claude ?? EMPTY_ROSTER, null)
  const codexState = remote
    ? ownerUsage.accounts?.codex
    : {
        ...resolveCodexStatusAccountState(settings, localCodex, null),
        ...(localCodex.systemDefault ? { systemDefault: localCodex.systemDefault } : {})
      }
  const result: Partial<Record<ProviderId, UsageAccountEntry[]>> = {}
  if (claudeState?.accounts.length && !ownerUsage.accounts?.failedProviders?.includes('claude')) {
    result.claude = claudeEntries(claudeState, ownerUsage, systemDefaultLabel)
  }
  if (codexState?.accounts.length && !ownerUsage.accounts?.failedProviders?.includes('codex')) {
    result.codex = codexEntries(codexState, ownerUsage, systemDefaultLabel)
  }
  const antigravity = ownerUsage.rateLimits.antigravityAccounts
  if (antigravity.length > 0) {
    const live = ownerUsage.rateLimits.antigravity?.usageMetadata?.account
    result.antigravity = antigravity.map((account) => ({
      key: account.accountId,
      selected: account.active,
      reading: account.rateLimits,
      name: { email: account.email ?? (account.active ? live?.email : null) },
      fallbackLabel: t('auto.components.status.bar.antigravity.unknownAccount', 'Google account')
    }))
  }
  return result
}

/** The usage row's chips for the owner whose usage the bar shows, and whether 'all' could add any. */
export function getOwnerUsageRowChips(args: {
  ownerUsage: OwnerUsageRateLimits
  settings: GlobalSettings | null
  providers: readonly ProviderRateLimits[]
  accounts: StatusBarUsageAccounts
  localRosters?: LocalUsageAccountRosters
  t?: Translate
}): { usageChips: UsageRowChip[]; hasSavedAccounts: boolean } {
  const accountsByProvider = getOwnerUsageAccounts(
    args.ownerUsage,
    args.settings,
    args.t,
    args.localRosters
  )
  return {
    usageChips: buildUsageRowChips({
      providers: args.providers,
      accounts: args.accounts,
      accountsByProvider
    }),
    // Why listed, not read: readings may not be in yet, and the choice is what shows them.
    hasSavedAccounts: args.providers.some((p) => (accountsByProvider[p.provider]?.length ?? 0) > 0)
  }
}
