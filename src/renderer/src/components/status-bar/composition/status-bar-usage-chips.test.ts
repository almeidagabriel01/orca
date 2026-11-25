import { describe, expect, it } from 'vitest'
import type {
  ProviderRateLimits,
  RateLimitState
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import { createEmptyRateLimitState } from '../../../../../shared/agent-usage/rate-limits/rate-limit-state-factory'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'
import {
  getOwnerUsageRowChips,
  getUsageAccountLabel,
  resolveUsageAccountLabels
} from './status-bar-usage-chips'

const HOST = { runtime: 'host', wslDistro: null } as const

function reading(
  provider: ProviderRateLimits['provider'],
  usedPercent: number
): ProviderRateLimits {
  const window = { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: null }
  return { provider, session: window, weekly: null, updatedAt: 1, error: null, status: 'ok' }
}

const liveClaude = reading('claude', 7)
const liveCodex = reading('codex', 18)
const sideClaude = reading('claude', 78)

function owner(
  rateLimits: Partial<RateLimitState>,
  remote?: Pick<OwnerUsageRateLimits, 'accounts'>
): OwnerUsageRateLimits {
  return {
    owner: null,
    rateLimits: createEmptyRateLimitState({
      claude: liveClaude,
      codex: liveCodex,
      claudeTarget: HOST,
      codexTarget: HOST,
      inactiveClaudeAccounts: [],
      inactiveCodexAccounts: [],
      antigravityAccounts: [],
      ...rateLimits
    }),
    accounts: remote?.accounts ?? null,
    remoteOwner: remote ? { environmentId: 'server', label: 'Server' } : null,
    refreshRemote: null
  }
}

const saved = { createdAt: 1, updatedAt: 1, lastAuthenticatedAt: 1 }

describe('usage account labels', () => {
  it('prefers the Settings name, then the email local part, then the org', () => {
    expect(getUsageAccountLabel({ displayName: 'Work', email: 'me@work.dev' })).toBe('Work')
    expect(getUsageAccountLabel({ displayName: '  ', email: 'me@work.dev' })).toBe('me')
    expect(getUsageAccountLabel({ email: null, organizationName: 'Acme' })).toBe('Acme')
    expect(getUsageAccountLabel({})).toBeUndefined()
  })

  it('keeps the domain when two accounts share a local part, but never overrides a chosen name', () => {
    const entry = (key: string, name: { displayName?: string; email: string }) => ({
      key,
      selected: false,
      reading: null,
      name
    })
    expect(
      resolveUsageAccountLabels([
        entry('a', { email: 'gabriel@beyond.dev' }),
        entry('b', { email: 'gabriel@other.io' }),
        entry('c', { email: 'ops@other.io' })
      ])
    ).toEqual(['gabriel@beyond', 'gabriel@other', 'ops'])
    expect(
      resolveUsageAccountLabels([
        entry('a', { displayName: 'gabriel', email: 'x@beyond.dev' }),
        entry('b', { email: 'gabriel@other.io' })
      ])
    ).toEqual(['gabriel', 'gabriel@other'])
  })
})

describe('per-account usage rows', () => {
  const settings: GlobalSettings = {
    ...getDefaultSettings('/home/test'),
    claudeManagedAccounts: [
      {
        id: 'work',
        email: 'me@work.dev',
        managedAuthPath: '/w',
        authMethod: 'subscription-oauth',
        ...saved
      },
      {
        id: 'side',
        email: 'gabriel@side.dev',
        managedAuthPath: '/s',
        authMethod: 'subscription-oauth',
        ...saved
      }
    ],
    activeClaudeManagedAccountId: 'work',
    codexManagedAccounts: [
      { id: 'alpha', email: 'dev@alpha.io', managedHomePath: '/a', ...saved },
      { id: 'beta', email: 'dev@beta.io', managedHomePath: '/b', ...saved }
    ],
    activeCodexManagedAccountId: 'alpha',
    accountNames: { 'claude:me@work.dev': { name: 'Work', updatedAt: 1 } }
  }
  const ownerUsage = owner({
    inactiveClaudeAccounts: [
      { accountId: 'side', rateLimits: sideClaude, updatedAt: 1, isFetching: false }
    ],
    inactiveCodexAccounts: [{ accountId: 'beta', rateLimits: null, updatedAt: 1, isFetching: true }]
  })

  it('keeps every chip in place when the selected account switches', () => {
    const order = (active: { claude: string; codex: string }) =>
      getOwnerUsageRowChips({
        ownerUsage,
        settings: {
          ...settings,
          activeClaudeManagedAccountId: active.claude,
          activeCodexManagedAccountId: active.codex
        },
        providers: [liveClaude, liveCodex],
        accounts: 'all'
      }).usageChips.map((chip) => `${chip.p.provider}:${chip.accountKey}`)
    const before = order({ claude: 'work', codex: 'alpha' })
    expect(before).toEqual(['claude:work', 'claude:side', 'codex:alpha', 'codex:beta'])
    expect(order({ claude: 'side', codex: 'beta' })).toEqual(before)
  })

  it('gives every saved Claude and Codex account its own labelled row', () => {
    const { usageChips, hasSavedAccounts } = getOwnerUsageRowChips({
      ownerUsage,
      settings,
      providers: [liveClaude, liveCodex],
      accounts: 'all'
    })
    expect(hasSavedAccounts).toBe(true)
    expect(
      usageChips.map(({ id, accountLabel, selected }) => ({ id, accountLabel, selected }))
    ).toEqual([
      { id: 'claude', accountLabel: 'Work', selected: true },
      { id: 'claude:side', accountLabel: 'gabriel', selected: false },
      { id: 'codex', accountLabel: 'dev@alpha', selected: true },
      { id: 'codex:beta', accountLabel: 'dev@beta', selected: false }
    ])
    expect(usageChips[0]!.p).toBe(liveClaude)
    expect(usageChips[1]!.p).toBe(sideClaude)
    // Why: an account not read yet still gets a row, showing dashes rather than another's numbers.
    expect(usageChips[3]!.p).toMatchObject({ provider: 'codex', session: null, status: 'fetching' })
  })

  it('keeps one unlabelled row per provider with Active account', () => {
    const { usageChips } = getOwnerUsageRowChips({
      ownerUsage,
      settings,
      providers: [liveClaude, liveCodex, reading('grok', 39)],
      accounts: 'active'
    })
    expect(usageChips.map(({ id, accountLabel }) => ({ id, accountLabel }))).toEqual([
      { id: 'claude', accountLabel: undefined },
      { id: 'codex', accountLabel: undefined },
      { id: 'grok', accountLabel: undefined }
    ])
  })

  it("names a paired server's System default login by its email, never as Active", () => {
    const remote = owner(
      {},
      {
        accounts: {
          claude: {
            accounts: [
              {
                id: 'laptop',
                email: 'x@y.io',
                displayName: 'Laptop',
                authMethod: 'subscription-oauth',
                ...saved
              }
            ],
            activeAccountId: null,
            systemDefaultEmail: 'root@server.io'
          },
          codex: { accounts: [], activeAccountId: null },
          rateLimits: null
        }
      }
    )
    const { usageChips } = getOwnerUsageRowChips({
      ownerUsage: remote,
      settings: null,
      providers: [liveClaude, liveCodex],
      accounts: 'all'
    })
    expect(
      usageChips.map(({ id, accountLabel, selected, p }) => [id, accountLabel, selected, p.status])
    ).toEqual([
      ['claude', 'root', true, 'ok'],
      ['claude:laptop', 'Laptop', false, 'unavailable'],
      ['codex', undefined, undefined, 'ok']
    ])
  })

  it("names this device's selected System default login by its email", () => {
    const { usageChips } = getOwnerUsageRowChips({
      ownerUsage,
      settings: { ...settings, activeClaudeManagedAccountId: null },
      providers: [liveClaude],
      accounts: 'all',
      localRosters: {
        claude: { accounts: [], activeAccountId: null, systemDefaultEmail: 'gabriel@home.dev' }
      }
    })
    expect(
      usageChips.map(({ id, accountLabel, selected }) => [id, accountLabel, selected])
    ).toEqual([
      ['claude', 'gabriel@home', true],
      ['claude:work', 'Work', false],
      ['claude:side', 'gabriel@side', false]
    ])
  })
})
