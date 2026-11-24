import { expect, it } from 'vitest'
import { accountOwnerFor } from '@/runtime/provider-accounts/ownership/wsl-host-account-owner'
import { isOwnerReturnToLocal, resolveOwnerUsageRateLimits } from './owner-usage-rate-limits'
import { createEmptyRateLimitState } from '../../../../../shared/agent-usage/rate-limits/rate-limit-state-factory'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

it('treats only a remote-to-local owner change as a return to this device', () => {
  const local = accountOwnerFor({ kind: 'local' }, null)
  const remote = accountOwnerFor({ kind: 'environment', environmentId: 'mini' }, null)
  const otherRemote = accountOwnerFor({ kind: 'environment', environmentId: 'studio' }, null)
  const wsl = accountOwnerFor({ kind: 'environment', environmentId: 'wsl' }, 'Ubuntu')

  expect(isOwnerReturnToLocal(remote, local)).toBe(true)
  expect(isOwnerReturnToLocal(local, local)).toBe(false)
  expect(isOwnerReturnToLocal(local, remote)).toBe(false)
  expect(isOwnerReturnToLocal(remote, otherRemote)).toBe(false)
  expect(isOwnerReturnToLocal(remote, null)).toBe(false)
  expect(isOwnerReturnToLocal(null, local)).toBe(false)
  expect(isOwnerReturnToLocal(remote, wsl)).toBe(false)
  expect(isOwnerReturnToLocal(wsl, local)).toBe(false)
})

it('shows a not-set-up chip only for providers whose CLI the owning host has', () => {
  const ok = (provider: 'claude' | 'antigravity'): ProviderRateLimits => ({
    provider,
    status: 'ok',
    error: null,
    updatedAt: 1,
    weekly: null,
    session: { usedPercent: 10, windowMinutes: 300, resetsAt: null, resetDescription: null }
  })
  const local = createEmptyRateLimitState({ claude: ok('claude'), antigravity: ok('antigravity') })
  const missing: ProviderRateLimits = {
    ...ok('antigravity'),
    status: 'unavailable',
    session: null,
    usageMetadata: { failureKind: 'cli-unavailable' }
  }
  const remote = createEmptyRateLimitState({ claude: ok('claude'), antigravity: missing })
  const resolve = (installedAgents: TuiAgent[] | null) =>
    resolveOwnerUsageRateLimits(local, {
      kind: 'remote',
      ownerLabel: 'vps',
      rateLimits: remote,
      installedAgents
    }).antigravity

  expect(resolve(['claude'])).toBe(missing)
  expect(resolve(null)).toBe(missing)
  expect(resolve(['claude', 'antigravity'])?.usageMetadata?.ownerNotSetUp).toEqual({
    kind: 'not-configured',
    ownerLabel: 'vps',
    signInSavedHereOnly: false
  })
})
