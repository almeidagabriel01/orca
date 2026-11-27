import { defineFixture } from '../../../component-fixtures/component-fixture'
import { createEmptyRateLimitState } from '../../../../../shared/agent-usage/rate-limits/rate-limit-state-factory'
import type {
  ProviderRateLimits,
  RateLimitState
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { isProviderConfigured } from '../composition/status-bar-provider-visibility'
import { resolveOwnerUsageRateLimits } from './owner-usage-rate-limits'
import { ProviderSegment } from './StatusBarProviderSegment'

const NOW = Date.now()

function ok(provider: ProviderRateLimits['provider'], used: number): ProviderRateLimits {
  return {
    provider,
    status: 'ok',
    error: null,
    updatedAt: NOW,
    weekly: null,
    session: { usedPercent: used, windowMinutes: 300, resetsAt: null, resetDescription: null }
  }
}

function unavailable(
  provider: ProviderRateLimits['provider'],
  failureKind: 'cli-unavailable' | 'missing-credentials'
): ProviderRateLimits {
  return {
    provider,
    status: 'unavailable',
    error: null,
    updatedAt: NOW,
    weekly: null,
    session: null,
    usageMetadata: { failureKind }
  }
}

// This Mac uses Kimi; the vps host has no kimi binary.
const LOCAL: RateLimitState = createEmptyRateLimitState({
  claude: ok('claude', 18),
  kimi: ok('kimi', 40)
})
const REMOTE: RateLimitState = createEmptyRateLimitState({
  claude: ok('claude', 18),
  kimi: unavailable('kimi', 'cli-unavailable')
})

function bar(rateLimits: RateLimitState): React.JSX.Element {
  const shown = [rateLimits.claude, rateLimits.kimi].filter(isProviderConfigured)
  return (
    <div className="flex items-center gap-3 whitespace-nowrap bg-background px-2 py-1 text-xs">
      {shown.map((p) => (
        <ProviderSegment key={p.provider} p={p} display="used" mode="verbose" />
      ))}
    </div>
  )
}

/** Focused workspace on vps, which has no kimi: no Kimi chip. */
export const vpsWithoutKimi = defineFixture({
  width: 520,
  render: () =>
    bar(
      resolveOwnerUsageRateLimits(LOCAL, {
        kind: 'remote',
        ownerLabel: 'vps',
        rateLimits: REMOTE,
        installedAgents: ['claude']
      })
    )
})

/** kimi installed on vps but signed out: the chip still says so. */
export const vpsWithKimiSignedOut = defineFixture({
  width: 520,
  render: () =>
    bar(
      resolveOwnerUsageRateLimits(LOCAL, {
        kind: 'remote',
        ownerLabel: 'vps',
        rateLimits: {
          ...REMOTE,
          kimi: unavailable('kimi', 'missing-credentials')
        },
        installedAgents: ['claude', 'kimi']
      })
    )
})
