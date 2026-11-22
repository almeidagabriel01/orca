import type {
  InactiveAccountUsage,
  ProviderRateLimits
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { StatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import {
  getManagedAccountDisplayName,
  getManagedAccountPrimaryLabel
} from '../../../../../shared/agent-accounts/managed-account-display-names'
import { getOwnerInactiveAccounts } from '../accounts/owner-account-rows'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'

type AccountProvider = 'claude' | 'codex'

/** One chip in the status bar usage row. */
export type UsageRowChip = {
  /** The provider for its active reading; provider and account id for a saved account's reading. */
  id: string
  p: ProviderRateLimits
  /** Set when the row shows several accounts of the chip's provider. */
  accountLabel?: string
}

/**
 * The row's chips: one per shown provider, then with 'all' one per saved inactive Claude/Codex
 * account that has a reading. Why last: the row folds chips from its end, so extras give way first.
 */
export function buildUsageRowChips(args: {
  providers: readonly ProviderRateLimits[]
  accounts: StatusBarUsageAccounts
  inactive: Record<AccountProvider, readonly InactiveAccountUsage[]>
  accountName: (provider: AccountProvider, accountId: string) => string | undefined
  activeLabel: string
}): UsageRowChip[] {
  const { providers, accountName } = args
  const extras: UsageRowChip[] = []
  const multiAccount = new Set<string>()
  if (args.accounts === 'all') {
    for (const provider of ['claude', 'codex'] as const) {
      if (!providers.some((p) => p.provider === provider)) {
        continue
      }
      for (const account of args.inactive[provider]) {
        const name = accountName(provider, account.accountId)
        // Why skip unnamed: a reading for an account the roster no longer lists has no owner to show.
        if (!account.rateLimits || !name) {
          continue
        }
        extras.push({
          id: `${provider}:${account.accountId}`,
          p: account.rateLimits,
          accountLabel: name
        })
        multiAccount.add(provider)
      }
    }
  }
  const active = providers.map((p): UsageRowChip => {
    const provider = p.provider
    if ((provider !== 'claude' && provider !== 'codex') || !multiAccount.has(provider)) {
      return { id: provider, p }
    }
    const readingId = p.usageMetadata?.readingAccount?.accountId
    const name = readingId ? accountName(provider, readingId) : undefined
    return { id: p.provider, p, accountLabel: name ?? args.activeLabel }
  })
  return [...active, ...extras]
}

type AccountSettings = Pick<
  GlobalSettings,
  'claudeManagedAccounts' | 'codexManagedAccounts' | 'managedAccountDisplayNames'
>

/** The usage row's chips for the owner whose usage the bar shows, and whether 'all' could add any. */
export function getOwnerUsageRowChips(args: {
  ownerUsage: OwnerUsageRateLimits
  settings: AccountSettings | null
  providers: readonly ProviderRateLimits[]
  shown: Record<AccountProvider, boolean>
  accounts: StatusBarUsageAccounts
  activeLabel: string
}): { usageChips: UsageRowChip[]; hasSavedAccounts: boolean } {
  const { ownerUsage, settings, shown } = args
  const remote = ownerUsage.remoteOwner !== null
  // Why: a remote owner's names ride its own accounts snapshot; this device's are in Settings.
  const savedAccounts = (provider: AccountProvider) =>
    remote
      ? (ownerUsage.accounts?.[provider].accounts ?? [])
      : ((provider === 'claude'
          ? settings?.claudeManagedAccounts
          : settings?.codexManagedAccounts) ?? [])
  const accountName = (provider: AccountProvider, accountId: string): string | undefined => {
    const account = savedAccounts(provider).find((saved) => saved.id === accountId)
    if (!account) {
      return undefined
    }
    return remote
      ? getManagedAccountPrimaryLabel(account)
      : (getManagedAccountDisplayName(settings?.managedAccountDisplayNames, provider, accountId) ??
          account.email)
  }
  return {
    usageChips: buildUsageRowChips({
      providers: args.providers,
      accounts: args.accounts,
      inactive: {
        claude: shown.claude ? getOwnerInactiveAccounts('claude', ownerUsage) : [],
        codex: shown.codex ? getOwnerInactiveAccounts('codex', ownerUsage) : []
      },
      accountName,
      activeLabel: args.activeLabel
    }),
    // Why saved, not read: readings may not be in yet, and the choice is what asks for them.
    hasSavedAccounts:
      (shown.claude && savedAccounts('claude').length > 0) ||
      (shown.codex && savedAccounts('codex').length > 0)
  }
}
