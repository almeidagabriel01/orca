// Account nicknames are global: keyed by the login's identity (provider + email + org), not by a
// host's saved-account id, so the same login carries the same name on every host that syncs them.

export type AccountNameProvider = string

/** A name, or a clear (`name: null`), stamped so hosts can merge newest-wins. */
export type AccountNameEntry = { name: string | null; updatedAt: number }

/** Identity key → entry. Clears stay as tombstones so a sync cannot resurrect an old name. */
export type AccountNames = Record<string, AccountNameEntry>

export type AccountNamesSettings = {
  accountNames?: AccountNames
}

export type AccountIdentity = {
  email?: string | null
  /** Claude organization uuid or Codex workspace account id: one email can sign in to several. */
  organization?: string | null
}

/** Null when the login has no email to name it by. */
export function accountIdentityKey(
  provider: AccountNameProvider,
  identity: AccountIdentity
): string | null {
  const email = identity.email?.trim().toLowerCase()
  if (!email) {
    return null
  }
  const organization = identity.organization?.trim().toLowerCase()
  return organization ? `${provider}:${email}#${organization}` : `${provider}:${email}`
}

export function resolveAccountName(
  names: AccountNames | null | undefined,
  provider: AccountNameProvider,
  identity: AccountIdentity
): string | undefined {
  const key = accountIdentityKey(provider, identity)
  const name = key ? names?.[key]?.name?.trim() : undefined
  return name || undefined
}

/** Newest entry per key wins; returns `a` itself when `b` adds nothing newer. */
export function mergeAccountNames(
  a: AccountNames | null | undefined,
  b: AccountNames | null | undefined
): AccountNames {
  const base = a ?? {}
  let merged: AccountNames | null = null
  for (const [key, entry] of Object.entries(b ?? {})) {
    if ((base[key]?.updatedAt ?? -1) < entry.updatedAt) {
      merged ??= { ...base }
      merged[key] = entry
    }
  }
  return merged ?? base
}

/** The next map with `key` named (or cleared when `name` is null/blank). */
export function withAccountName(
  names: AccountNames | null | undefined,
  key: string,
  name: string | null,
  now: number = Date.now()
): AccountNames {
  const trimmed = name?.trim() || null
  return { ...names, [key]: { name: trimmed, updatedAt: now } }
}
