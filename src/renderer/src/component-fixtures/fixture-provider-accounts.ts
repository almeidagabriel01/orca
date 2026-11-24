// Fixtures' stand-in for a host's Claude and Codex accounts and their usage readings.
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type {
  ProviderRateLimits,
  RateLimitState,
  UsageReadingAccount
} from '../../../shared/agent-usage/rate-limits/rate-limit-types'
import { createEmptyRateLimitState } from '../../../shared/agent-usage/rate-limits/rate-limit-state-factory'

const HOUR = 3_600_000
const stamp = { createdAt: 0, updatedAt: 0, lastAuthenticatedAt: 0 }

/** Work is the host's pick; the system login is none of the saved accounts. */
export const fixtureProviderAccounts: ProviderAccountsSnapshot = {
  claude: {
    accounts: [
      {
        id: 'work',
        email: 'work@example.com',
        organizationName: 'Acme Inc',
        authMethod: 'subscription-oauth',
        ...stamp
      },
      {
        id: 'personal',
        email: 'personal@example.com',
        displayName: 'Personal',
        authMethod: 'subscription-oauth',
        ...stamp
      },
      { id: 'side', email: 'side@example.com', authMethod: 'subscription-oauth', ...stamp }
    ],
    activeAccountId: 'work',
    systemDefaultEmail: 'me@example.com'
  },
  codex: {
    accounts: [{ id: 'codex-main', email: 'dev@example.com', ...stamp }],
    activeAccountId: 'codex-main'
  },
  rateLimits: null
}

const hostReading = (accountId: string): UsageReadingAccount => ({
  accountId,
  runtime: 'host',
  wslDistro: null
})

function limits(
  provider: 'claude' | 'codex',
  sessionUsed: number,
  weeklyUsed: number,
  now: number,
  accountId?: string
): ProviderRateLimits {
  return {
    provider,
    status: 'ok',
    error: null,
    updatedAt: now,
    session: {
      usedPercent: sessionUsed,
      windowMinutes: 300,
      // The usage-limit row fixtures' reset, so both name the same time.
      resetsAt: now + 134 * 60_000 + 30_000,
      resetDescription: null
    },
    weekly: {
      usedPercent: weeklyUsed,
      windowMinutes: 10080,
      resetsAt: now + 72 * HOUR,
      resetDescription: null
    },
    ...(accountId ? { usageMetadata: { readingAccount: hostReading(accountId) } } : {})
  }
}

/** Work spent until its 5h reset, Personal at 20%, Side near its weekly cap, Codex at 12%. */
export function fixtureAccountUsage(now: number): RateLimitState {
  const inactive = (accountId: string, reading: ProviderRateLimits) => ({
    accountId,
    rateLimits: reading,
    updatedAt: now,
    isFetching: false
  })
  return createEmptyRateLimitState({
    claude: limits('claude', 100, 31, now, 'work'),
    codex: limits('codex', 12, 9, now),
    inactiveClaudeAccounts: [
      inactive('personal', limits('claude', 20, 8, now)),
      inactive('side', limits('claude', 41, 85, now))
    ]
  })
}
