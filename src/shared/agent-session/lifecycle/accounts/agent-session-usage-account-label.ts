// The account a chat's `/usage` names, shared by desktop and phone; each passes its own translator.

import { getAccountDisplayName } from '../../../agent-accounts/managed-account-display-names'
import type { AgentSessionUsageAccount } from './agent-session-account-usage'

export function agentSessionUsageAccountLabel(
  account: AgentSessionUsageAccount,
  t: (key: string, fallback: string) => string
): string {
  switch (account.kind) {
    case 'system':
      return getAccountDisplayName(account) ?? t('accounts.ownLogin', "This computer's login")
    case 'managed':
      return (
        getAccountDisplayName(account) ??
        t('auto.lib.codex.session.restart.9f0b1c2d3e', 'Codex account')
      )
    case 'shared':
      return (
        getAccountDisplayName(account) ??
        t('components.native-chat.usage.sharedAccount', 'Current shared account')
      )
  }
}
