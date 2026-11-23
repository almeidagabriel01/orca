import {
  projectAgentAccountChoice,
  withProjectAgentLaunchDefaults
} from '../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { AGENT_CHAT_ACCOUNT_OPTION_ID } from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { structuredLaunchSeedOptions } from '../../../../shared/native-chat/input/session-options/native-chat-session-option-defaults'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { StructuredAgentId } from '../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle'
import { getClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import { claudeChatAccountChoiceProblem } from '../../../claude-accounts/selection/claude-chat-account-choice'

/** What a new chat in this project starts with: the project's defaults over this host's. */
export function structuredProjectLaunchSeedOptions(
  settings: NonNullable<Parameters<typeof structuredLaunchSeedOptions>[0]>,
  repo: Repo | null,
  agent: StructuredAgentId,
  /** Only create seeds the account; a client's own pick still replaces it. */
  withAccount = false
): Record<string, string> | undefined {
  const seed = structuredLaunchSeedOptions(withProjectAgentLaunchDefaults(settings, repo), agent)
  const account = withAccount ? projectAgentAccountChoice(repo, agent) : undefined
  // A removed or signed-out account falls back to the host's selection instead of refusing every chat.
  return account && !claudeChatAccountChoiceProblem(getClaudeProfileRouter(), account)
    ? { ...seed, [AGENT_CHAT_ACCOUNT_OPTION_ID]: account }
    : seed
}
