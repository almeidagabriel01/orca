import type { ClaudeRateLimitAccountsState } from '../../../shared/agent-accounts/managed-account-types'
import type { ManagedAccountDisplayNames } from '../../../shared/agent-accounts/managed-account-display-names'
import type { AccountNames } from '../../../shared/agent-accounts/account-names'
import {
  managedAccountIdentity,
  migrateLegacyAccountNames,
  withAccountNames
} from '../../../shared/agent-accounts/account-name-identity'
import type { ClaudeFolderLogin } from '../sign-in/claude-account-folder'

type NamesStore = {
  getSettings: () => {
    accountNames?: AccountNames
    managedAccountDisplayNames?: ManagedAccountDisplayNames
  }
  updateSettings: (
    patch: { accountNames: AccountNames; managedAccountDisplayNames: ManagedAccountDisplayNames },
    options?: { notifyListeners?: boolean }
  ) => unknown
}

/**
 * Names the rows and System default by login, first moving old id-keyed names to identities.
 * `systemLogin` is read even when the state omits it (no saved accounts).
 */
export function withClaudeAccountNames(
  store: NamesStore,
  state: ClaudeRateLimitAccountsState,
  systemLogin: ClaudeFolderLogin | null
): ClaudeRateLimitAccountsState {
  const settings = store.getSettings()
  const system = { email: systemLogin?.email, organization: systemLogin?.organizationUuid }
  const migrated = migrateLegacyAccountNames(
    settings.accountNames,
    settings.managedAccountDisplayNames,
    'claude',
    state.accounts.map((account) => ({
      id: account.id,
      identity: managedAccountIdentity(account)
    })),
    system
  )
  if (migrated) {
    store.updateSettings(migrated, { notifyListeners: true })
  }
  return withAccountNames(state, migrated?.accountNames ?? settings.accountNames, 'claude', system)
}
