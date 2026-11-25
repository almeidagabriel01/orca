// Where each account surface finds its login identity, so every host and reader keys a name alike.

import {
  accountIdentityKey,
  resolveAccountName,
  type AccountIdentity,
  type AccountNames
} from './account-names'
import {
  SYSTEM_DEFAULT_ACCOUNT_NAME_KEY,
  type ManagedAccountDisplayNames,
  type ManagedAccountNameProvider
} from './managed-account-display-names'

/** A saved Claude or Codex account: Claude keys by organization uuid, Codex by workspace id. */
export function managedAccountIdentity(account: {
  email?: string | null
  organizationUuid?: string | null
  workspaceAccountId?: string | null
}): AccountIdentity {
  return {
    email: account.email,
    organization: account.organizationUuid ?? account.workspaceAccountId
  }
}

/** The provider's own login on a host, as its Claude or Codex account state reports it. */
export function systemDefaultIdentity(
  state:
    | {
        systemDefaultEmail?: string
        systemDefaultOrganizationUuid?: string
        systemDefault?: { email?: string | null; workspaceAccountId?: string | null }
      }
    | null
    | undefined
): AccountIdentity {
  return state?.systemDefaultEmail
    ? { email: state.systemDefaultEmail, organization: state.systemDefaultOrganizationUuid }
    : { email: state?.systemDefault?.email, organization: state?.systemDefault?.workspaceAccountId }
}

type NamedRow = {
  id: string
  email?: string | null
  organizationUuid?: string | null
  workspaceAccountId?: string | null
  displayName?: string
}

/** Fills each row's and System default's name from the global names; same state when nothing differs. */
export function withAccountNames<
  State extends {
    accounts: readonly NamedRow[]
    systemDefaultDisplayName?: string
    systemDefaultEmail?: string
    systemDefaultOrganizationUuid?: string
    systemDefault?: { email?: string | null; workspaceAccountId?: string | null }
  }
>(
  state: State,
  names: AccountNames | null | undefined,
  provider: ManagedAccountNameProvider,
  /** Where the state omits System default's login, the caller's own read of it. */
  system: AccountIdentity = systemDefaultIdentity(state)
): State {
  if (!names) {
    return state
  }
  let changed = false
  const accounts = state.accounts.map((account) => {
    const displayName = resolveAccountName(names, provider, managedAccountIdentity(account))
    if (displayName === account.displayName) {
      return account
    }
    changed = true
    const { displayName: _previous, ...rest } = account
    return displayName ? { ...rest, displayName } : rest
  })
  // No readable login here (e.g. no saved accounts): keep whatever name the host filled in.
  const systemName = system.email
    ? resolveAccountName(names, provider, system)
    : state.systemDefaultDisplayName
  if (!changed && systemName === state.systemDefaultDisplayName) {
    return state
  }
  const next = { ...state, accounts }
  if (systemName) {
    next.systemDefaultDisplayName = systemName
  } else {
    delete next.systemDefaultDisplayName
  }
  return next
}

/**
 * Moves the old id-keyed names of `provider` to identity entries stamped 0, so any real rename
 * or clear wins. Null when nothing moves. A System default name waits until its login is
 * readable; a name whose account is gone is dropped.
 */
export function migrateLegacyAccountNames(
  names: AccountNames | null | undefined,
  legacy: ManagedAccountDisplayNames | null | undefined,
  provider: ManagedAccountNameProvider,
  accounts: readonly { id: string; identity: AccountIdentity }[],
  system: AccountIdentity
): { accountNames: AccountNames; managedAccountDisplayNames: ManagedAccountDisplayNames } | null {
  const old = legacy?.[provider]
  if (!old || Object.keys(old).length === 0) {
    return null
  }
  const migrated: AccountNames = {}
  const kept: Record<string, string> = {}
  for (const [id, name] of Object.entries(old)) {
    const identity =
      id === SYSTEM_DEFAULT_ACCOUNT_NAME_KEY
        ? system
        : accounts.find((account) => account.id === id)?.identity
    const key = identity ? accountIdentityKey(provider, identity) : null
    if (key) {
      migrated[key] ??= { name, updatedAt: 0 }
    } else if (id === SYSTEM_DEFAULT_ACCOUNT_NAME_KEY) {
      kept[id] = name
    }
  }
  if (Object.keys(kept).length === Object.keys(old).length) {
    return null
  }
  return {
    // Existing entries (real renames, clears) always beat a migrated one.
    accountNames: { ...migrated, ...names },
    managedAccountDisplayNames: { ...legacy, [provider]: kept }
  }
}

/** Entries of `from` newer than `into`'s: what a merge of `from` into `into` would change. */
export function newerAccountNames(
  into: AccountNames | null | undefined,
  from: AccountNames | null | undefined
): AccountNames | null {
  const newer = Object.entries(from ?? {}).filter(
    ([key, entry]) => (into?.[key]?.updatedAt ?? -1) < entry.updatedAt
  )
  return newer.length > 0 ? Object.fromEntries(newer) : null
}

/** One host pair's sync: what each side lacks. Ties (equal stamps) never write. */
export function planAccountNamesSync(
  local: AccountNames | null | undefined,
  remote: AccountNames | null | undefined
): { toLocal: AccountNames | null; toRemote: AccountNames | null } {
  return { toLocal: newerAccountNames(local, remote), toRemote: newerAccountNames(remote, local) }
}
