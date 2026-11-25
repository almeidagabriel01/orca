import {
  accountIdentityKey,
  withAccountName,
  type AccountIdentity,
  type AccountNames
} from '../../shared/agent-accounts/account-names'
import { newerAccountNames } from '../../shared/agent-accounts/account-name-identity'
import { normalizeManagedAccountDisplayName } from '../../shared/agent-accounts/managed-account-display-names'

export type AccountNamesStore = {
  getSettings: () => { accountNames?: AccountNames }
  updateSettings: (
    patch: { accountNames: AccountNames },
    options?: { notifyListeners?: boolean }
  ) => unknown
}

export const ACCOUNT_WITHOUT_EMAIL_NAME_MESSAGE =
  'This account has no sign-in email to name it by. Sign in first, then rename it.'

/** Names a login on this host (blank clears it); false when nothing changed, so callers skip republishing. */
export function setStoredAccountName(
  store: AccountNamesStore,
  provider: string,
  identity: AccountIdentity,
  input: string | null
): boolean {
  const key = accountIdentityKey(provider, identity)
  if (!key) {
    throw new Error(ACCOUNT_WITHOUT_EMAIL_NAME_MESSAGE)
  }
  const name = normalizeManagedAccountDisplayName(input)
  const current = store.getSettings().accountNames
  const entry = current?.[key]
  if (entry ? entry.name === name : name === null) {
    return false
  }
  store.updateSettings(
    { accountNames: withAccountName(current, key, name) },
    { notifyListeners: true }
  )
  return true
}

/** Takes another host's newer entries; false when it has none, so a sync never loops. */
export function mergeStoredAccountNames(store: AccountNamesStore, names: AccountNames): boolean {
  const current = store.getSettings().accountNames
  const newer = newerAccountNames(current, names)
  if (!newer) {
    return false
  }
  store.updateSettings({ accountNames: { ...current, ...newer } }, { notifyListeners: true })
  return true
}
