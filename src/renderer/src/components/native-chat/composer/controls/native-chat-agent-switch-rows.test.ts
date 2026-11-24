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
