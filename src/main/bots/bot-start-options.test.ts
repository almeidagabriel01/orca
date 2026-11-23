import { describe, expect, it } from 'vitest'
import { botStartAccount } from './bot-start-options'
import { makeTestBot } from './bot.test-fixture'
import { BotSchema } from '../../shared/bot-types'
import { applyBotUpdates } from '../../shared/rpc-contract/bots-params'
import { AGENT_CHAT_ACCOUNT_OPTION_ID as ACCOUNT } from '../../shared/agent-launch/accounts/agent-chat-account-choice'

describe("a bot's account", () => {
  const bot = makeTestBot({ agent: 'claude' })

  it('starts every new conversation on it until cleared or the agent changes', () => {
    const saved = applyBotUpdates(bot, { agentAccount: 'system' })
    expect(botStartAccount(saved)).toEqual({ [ACCOUNT]: 'system' })
    expect(botStartAccount(applyBotUpdates(saved, { agentAccount: null }))).toEqual({})
    const codex = applyBotUpdates(saved, { agent: 'codex' })
    expect(codex.agentAccount).toBeUndefined()
    // An account belongs to Claude: another agent never sends one, or create would refuse.
    expect(botStartAccount({ agent: 'codex', agentAccount: 'system' })).toEqual({})
  })

  it('falls back to the host selection for an account this host no longer has', () => {
    expect(botStartAccount({ agent: 'claude', agentAccount: 'removed-account' })).toEqual({})
  })

  it('reads a malformed saved account as unset instead of losing the bot', () => {
    const parsed = BotSchema.safeParse({ ...bot, agentAccount: 'host' })
    expect(parsed.success && parsed.data.agentAccount).toBeUndefined()
  })
})
