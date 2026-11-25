import { describe, expect, it } from 'vitest'
import { translate } from '@/i18n/i18n'
import { createEmptyRateLimitState } from '../../../../../../shared/agent-usage/rate-limits/rate-limit-state-factory'
import type { ProviderRateLimits } from '../../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { agentSwitchMenuModel } from './native-chat-agent-switch-rows'

const reading = (
  provider: ProviderRateLimits['provider'],
  status: ProviderRateLimits['status']
): ProviderRateLimits => ({
  provider,
  session: null,
  weekly: null,
  updatedAt: 1,
  error: null,
  status
})

describe('agentSwitchMenuModel provider filter', () => {
  const base = {
    agent: 'claude',
    agents: ['claude', 'codex', 'pi', 'kimi', 'grok', 'copilot'],
    choice: undefined,
    accounts: null,
    display: 'used' as const,
    now: 0,
    locale: 'en',
    t: translate,
    usage: createEmptyRateLimitState({
      kimi: reading('kimi', 'unavailable'),
      grok: reading('grok', 'unavailable'),
      codex: reading('codex', 'ok')
    }),
    installed: (agent: string) => ['claude', 'codex', 'kimi', 'grok', 'copilot'].includes(agent)
  }
  const agentsOf = (rows: { agent: string }[]): string[] => [...new Set(rows.map((r) => r.agent))]

  it('offers only installed agents not known to be signed out, and counts the rest', () => {
    const model = agentSwitchMenuModel(base)
    // pi: no CLI; kimi/grok: CLI but signed out; copilot: CLI, no sign-in signal.
    expect(agentsOf(model.rows)).toEqual(['claude', 'codex', 'copilot'])
    expect(model.hiddenCount).toBe(3)
  })

  it('keeps the current agent and a working login without a CLI; show all lists everything', () => {
    const model = agentSwitchMenuModel({
      ...base,
      agent: 'pi',
      usage: createEmptyRateLimitState({ grokAuthConfigured: true }),
      installed: (agent: string) => agent === 'claude'
    })
    expect(agentsOf(model.rows)).toEqual(['claude', 'pi', 'grok'])
    expect(agentsOf(agentSwitchMenuModel({ ...base, showAll: true }).rows)).toHaveLength(6)
  })

  it('hides nothing while the inventory and readings load', () => {
    const model = agentSwitchMenuModel({ ...base, usage: null, installed: () => null })
    expect(model.hiddenCount).toBe(0)
  })
})

describe('agentSwitchMenuModel Claude accounts', () => {
  const stamp = { createdAt: 0, updatedAt: 0, lastAuthenticatedAt: 0 }
  const claude = (activeAccountId: string | null, systemDefaultEmail?: string) => ({
    accounts: [
      {
        id: 'beyond',
        email: 'b@example.com',
        displayName: 'Beyond',
        authMethod: 'subscription-oauth' as const,
        ...stamp
      }
    ],
    activeAccountId,
    ...(systemDefaultEmail ? { systemDefaultEmail, systemDefaultDisplayName: 'ProOps' } : {})
  })
  const model = (accounts: ReturnType<typeof claude>, choice?: string) =>
    agentSwitchMenuModel({
      agent: 'claude',
      agents: ['claude'],
      choice,
      accounts: {
        claude: accounts,
        codex: { accounts: [], activeAccountId: null },
        rateLimits: null
      },
      usage: null,
      display: 'used',
      now: 0,
      locale: 'en',
      t: translate
    })
  const summary = (m: ReturnType<typeof model>) =>
    m.rows.map((row) => [row.label, row.value === m.value, Boolean(row.isDefault)])

  it('follows the host as the own login row, selected and badged', () => {
    const m = model(claude(null, 'p@example.com'))
    expect(summary(m)).toEqual([
      ['ProOps', true, true],
      ['Beyond', false, false]
    ])
    expect(m.currentLabel).toBe('ProOps')
    expect(m.rows[0]?.target).toEqual({ agent: 'claude', accountChoice: 'system' })
  })

  it("follows the host's saved selection; a pinned chat keeps the badge on the default", () => {
    expect(summary(model(claude('beyond', 'p@example.com')))).toEqual([
      ['ProOps', false, false],
      ['Beyond', true, true]
    ])
    const pinned = model(claude(null, 'p@example.com'), 'beyond')
    expect(summary(pinned)).toEqual([
      ['ProOps', false, true],
      ['Beyond', true, false]
    ])
    expect(pinned.currentLabel).toBe('Beyond')
  })

  it('names an own login with no email as this computer and never says System default', () => {
    const m = model(claude(null))
    expect(m.rows[0]).toMatchObject({ label: "This computer's login", isDefault: true })
    expect(m.rows.map((row) => row.label).join()).not.toMatch(/System default|Follow the host/)
  })
})
