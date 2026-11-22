import { AGENT_CHAT_SYSTEM_ACCOUNT } from '../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { ClaudeProfileRouter } from '../profiles/routing/claude-profile-router'
import { CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE } from '../profiles/routing/claude-profile-launch-errors'
import { CLAUDE_ACCOUNT_NEEDS_SIGN_IN_MESSAGE } from './claude-account-selection'

/** Why a chat can't run on `choice` on this host, or null when it can. A chat only chooses among
 *  this host's own accounts: a WSL account can't run a native chat. */
export function claudeChatAccountChoiceProblem(
  router:
    | Pick<ClaudeProfileRouter, 'savedAccount' | 'accountLogin' | 'coveredBySystemDefault'>
    | undefined,
  choice: string
): string | null {
  if (choice === AGENT_CHAT_SYSTEM_ACCOUNT) {
    return null
  }
  const saved = router?.savedAccount(choice)
  if (!router || !saved || saved.managedAuthRuntime === 'wsl') {
    return CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE
  }
  return router.accountLogin(choice) || router.coveredBySystemDefault(choice)
    ? null
    : CLAUDE_ACCOUNT_NEEDS_SIGN_IN_MESSAGE
}
