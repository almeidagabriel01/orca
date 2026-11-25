import {
  getAccountDisplayName,
  getSystemDefaultDisplayName
} from '../../../../shared/agent-accounts/managed-account-display-names'
import { translate } from '@/i18n/i18n'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/agent-accounts/managed-account-types'

/** Display label for a selected Claude account row; null is the host's own login. */
export function getClaudeAccountLabel(
  state: Pick<ClaudeRateLimitAccountsState, 'accounts'> &
    Partial<Pick<ClaudeRateLimitAccountsState, 'systemDefaultEmail' | 'systemDefaultDisplayName'>>,
  accountId: string | null | undefined
): string {
  if (accountId == null) {
    return (
      getSystemDefaultDisplayName(state) ?? translate('accounts.ownLogin', "This computer's login")
    )
  }
  const account = state.accounts.find((entry) => entry.id === accountId)
  return (
    (account && getAccountDisplayName(account)) ??
    translate('accounts.claude.unnamedAccount', 'Claude account')
  )
}
