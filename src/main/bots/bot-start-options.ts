// The model and options a bot's new conversation starts on.
import type { Bot } from '../../shared/bot-types'
import { botLaunchSeedOptions } from '../../shared/bots/bot-launch'
import { explicitStructuredLaunchSeedOptions } from '../../shared/native-chat/input/session-options/native-chat-session-option-defaults'
import { AGENT_CHAT_ACCOUNT_OPTION_ID } from '../../shared/agent-launch/accounts/agent-chat-account-choice'
import { usableChatAccountChoice } from '../claude-accounts/selection/claude-chat-account-choice'

type LaunchSettings = Parameters<typeof explicitStructuredLaunchSeedOptions>[0]

/**
 * The bot's own launch comes first. A conversation the owner opens keeps the chat defaults otherwise.
 * Background work (Look around, tidy-up, an automation's new conversation) never reads the model
 * remembered from the owner's last chat pick: without the bot's own model it takes the owner's
 * explicit default for the agent (Settings > Agents), else the agent's own default. A launch that
 * sets only options keeps them over that default.
 */
export function botStartOptions(
  settings: () => LaunchSettings,
  bot: Pick<Bot, 'agent' | 'launch'>,
  background: boolean
): Record<string, string> {
  const own = botLaunchSeedOptions(bot.launch)
  if (!background || own?.model) {
    return own ?? {}
  }
  return {
    ...explicitStructuredLaunchSeedOptions(settings(), bot.agent),
    ...own
  }
}

/** The bot's own account as a create option, for every new conversation and automation run; none
 *  follows the host's selection, as does an account this host can no longer run. */
export function botStartAccount(bot: Pick<Bot, 'agent' | 'agentAccount'>): Record<string, string> {
  const account = usableChatAccountChoice(bot.agent, bot.agentAccount)
  return account ? { [AGENT_CHAT_ACCOUNT_OPTION_ID]: account } : {}
}
