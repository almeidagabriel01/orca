import { AGENT_CHAT_SYSTEM_ACCOUNT } from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { findClaudeAccount } from '../../selection/runtime-selection'
import { claudeChatAccountMissing } from './claude-profile-launch-errors'

/** The saved account a chat's `accountChoice` runs on: null for System default, undefined to follow
 *  the host's selection. A chosen account that is gone, or lives in WSL, refuses: falling back
 *  would run another account. */
export function claudeChatAccountId(
  settings: Pick<GlobalSettings, 'claudeManagedAccounts'>,
  accountChoice: string | undefined
): string | null | undefined {
  if (accountChoice === undefined || accountChoice === AGENT_CHAT_SYSTEM_ACCOUNT) {
    return accountChoice === undefined ? undefined : null
  }
  const saved = findClaudeAccount(settings, accountChoice)
  if (!saved || saved.managedAuthRuntime === 'wsl') {
    throw claudeChatAccountMissing()
  }
  return saved.id
}
