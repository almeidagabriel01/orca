import {
  projectAgentAccountChoice,
  withProjectAgentLaunchDefaults
} from '../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { AGENT_CHAT_ACCOUNT_OPTION_ID } from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { structuredLaunchSeedOptions } from '../../../../shared/native-chat/input/session-options/native-chat-session-option-defaults'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { StructuredAgentId } from '../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle'
import { usableChatAccountChoice } from '../../../claude-accounts/selection/claude-chat-account-choice'

/** What a new chat in this project starts with: the project's defaults over this host's. */
export function structuredProjectLaunchSeedOptions(
  settings: NonNullable<Parameters<typeof structuredLaunchSeedOptions>[0]>,
  repo: Repo | null,
  agent: StructuredAgentId,
  /** Only create seeds the account; a client's own pick still replaces it. */
  withAccount = false
): Record<string, string> | undefined {
  const seed = structuredLaunchSeedOptions(withProjectAgentLaunchDefaults(settings, repo), agent)
  const account = withAccount
    ? usableChatAccountChoice(agent, projectAgentAccountChoice(repo, agent))
    : undefined
  return account ? { ...seed, [AGENT_CHAT_ACCOUNT_OPTION_ID]: account } : seed
}
