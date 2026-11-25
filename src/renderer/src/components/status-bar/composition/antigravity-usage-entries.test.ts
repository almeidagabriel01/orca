import { describe, expect, it } from 'vitest'
import { createEmptyRateLimitState } from '../../../../../shared/agent-usage/rate-limits/rate-limit-state-factory'
import { accountIdentityKey } from '../../../../../shared/agent-accounts/account-names'
import { getAntigravityUsageEntries } from './antigravity-usage-entries'
import { resolveUsageAccountLabels } from './status-bar-usage-chips'

const t = (_key: string, fallback: string): string => fallback

describe('getAntigravityUsageEntries', () => {
  it('names each login by its global nickname, else the email local part, never the email', () => {
    const key = accountIdentityKey('antigravity', { email: 'Work@Example.com' })!
    const rateLimits = createEmptyRateLimitState({
      antigravityAccounts: [
        { accountId: 'a', email: 'work@example.com', active: true, rateLimits: null },
        { accountId: 'b', email: 'side@example.com', active: false, rateLimits: null },
        { accountId: 'c', email: null, active: false, rateLimits: null }
      ]
    })
    const entries = getAntigravityUsageEntries(
      rateLimits,
      { accountNames: { [key]: { name: 'Trabalho', updatedAt: 1 } } },
      t
    )
    expect(resolveUsageAccountLabels(entries)).toEqual(['Trabalho', 'side', 'Google account'])
  })
})
