import type {
  InactiveAccountUsage,
  RateLimitRuntimeTarget
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import {
  getProviderAccountsOwnerKey,
  type ProviderAccountsSnapshot
} from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { AccountOwner } from '@/runtime/provider-accounts/ownership/wsl-host-account-owner'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'

type AccountProvider = 'claude' | 'codex'

/** Remount a switcher when its owner changes, so pending actions never cross hosts. */
export function getAccountOwnerKey(owner: AccountOwner): string {
  return `${getProviderAccountsOwnerKey(owner.target)}:${owner.wslHostDistro ?? ''}`
}

/** The owner's per-account readings; an unreachable host cannot vouch for its old ones. */
export function getOwnerInactiveAccounts(
  provider: AccountProvider,
  ownerUsage: OwnerUsageRateLimits
): InactiveAccountUsage[] {
  const owner = ownerUsage.rateLimits
  if (owner[provider]?.usageMetadata?.unverifiableOwner) {
    return []
  }
  return provider === 'claude' ? owner.inactiveClaudeAccounts : owner.inactiveCodexAccounts
}

/** Account rows read the snapshot of the host that owns the accounts, the one the bar shows. */
export function getOwnerAccountRows<P extends AccountProvider>(
  provider: P,
  ownerUsage: OwnerUsageRateLimits,
  localRoster: ProviderAccountsSnapshot[P],
  emptyRoster: ProviderAccountsSnapshot[P]
): {
  roster: ProviderAccountsSnapshot[P]
  /** False until a remote owner lists this provider; an empty roster would read as "System default". */
  rosterKnown: boolean
  inactiveAccounts: InactiveAccountUsage[]
  usageTarget: RateLimitRuntimeTarget
} {
  const owner = ownerUsage.rateLimits
  return {
    // Why: a remote roster comes from the snapshot that carries its readings, so names and numbers move together.
    roster: ownerUsage.remoteOwner ? (ownerUsage.accounts?.[provider] ?? emptyRoster) : localRoster,
    rosterKnown:
      !ownerUsage.remoteOwner ||
      (ownerUsage.accounts !== null && !ownerUsage.accounts.failedProviders?.includes(provider)),
    inactiveAccounts: getOwnerInactiveAccounts(provider, ownerUsage),
    usageTarget: provider === 'claude' ? owner.claudeTarget : owner.codexTarget
  }
}
