import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsageRowChip } from './status-bar-usage-chips'

/** An account's last reading with numbers, by provider and email, whichever host read it. */
export type AccountReadingMemory = Map<string, ProviderRateLimits>

/** "claude:me@x.com": a login's limits are the account's, the same on every host. */
export function usageAccountIdentity(
  provider: ProviderRateLimits['provider'],
  email: string | null | undefined
): string | undefined {
  const normalized = email?.trim().toLowerCase()
  return normalized ? `${provider}:${normalized}` : undefined
}

function hasUsageWindows(p: ProviderRateLimits): boolean {
  return Boolean(p.session || p.weekly || p.fableWeekly || p.monthly || p.buckets?.length)
}

/**
 * Each chip shows its account's newest reading from any host. A host that has never run the
 * account (Claude's "Updates when Claude runs") or is still fetching shows what another host last
 * read instead, so switching to a workspace on another host never blanks or flickers the chip.
 * Updates `memory` with every reading that has numbers.
 */
export function withRememberedAccountReadings(
  chips: readonly UsageRowChip[],
  memory: AccountReadingMemory
): UsageRowChip[] {
  return chips.map((chip) => {
    const key = chip.accountIdentity
    if (!key) {
      return chip
    }
    const known = memory.get(key)
    if (hasUsageWindows(chip.p) && (!known || chip.p.updatedAt >= known.updatedAt)) {
      memory.set(key, chip.p)
      return chip
    }
    return known ? { ...chip, p: known } : chip
  })
}
