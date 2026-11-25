export type ManagedAccountNameProvider = 'claude' | 'codex'

/** Legacy: names by saved account id, read once to migrate them to `accountNames` (identity-keyed). */
export type ManagedAccountDisplayNames = Partial<
  Record<ManagedAccountNameProvider, Record<string, string>>
>

export type ManagedAccountNameSettings = {
  /** Absent means every saved Claude/Codex account shows its sign-in email. */
  managedAccountDisplayNames?: ManagedAccountDisplayNames
}

export const MANAGED_ACCOUNT_DISPLAY_NAME_MAX_LENGTH = 120

export const MANAGED_ACCOUNT_DISPLAY_NAME_TOO_LONG_MESSAGE = `Account names can be at most ${MANAGED_ACCOUNT_DISPLAY_NAME_MAX_LENGTH} characters.`

/** Blank clears the name; the account then shows its sign-in email. */
export function normalizeManagedAccountDisplayName(
  input: string | null | undefined
): string | null {
  const trimmed = (input ?? '').trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > MANAGED_ACCOUNT_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(MANAGED_ACCOUNT_DISPLAY_NAME_TOO_LONG_MESSAGE)
  }
  return trimmed
}

/** Rename target for the provider's own sign-in (System default); saved accounts use their id. */
export const SYSTEM_DEFAULT_ACCOUNT_NAME_KEY = 'system'

/** The one name every surface shows for an account: the user's name for it, else the email's local part. */
export function getAccountDisplayName(account: {
  displayName?: string | null
  email?: string | null
}): string | undefined {
  return account.displayName?.trim() || account.email?.trim().split('@')[0] || undefined
}

/** System default's name: the host-set nickname, else its email's local part; undefined lets callers say "System default". */
export function getSystemDefaultDisplayName(
  state:
    | {
        systemDefaultDisplayName?: string
        systemDefaultEmail?: string
        systemDefault?: { email?: string | null }
      }
    | null
    | undefined
): string | undefined {
  return getAccountDisplayName({
    displayName: state?.systemDefaultDisplayName,
    email: state?.systemDefaultEmail ?? state?.systemDefault?.email
  })
}

type NamedAccount = { email: string; displayName?: string | null }

type NamedManagedAccount = { id: string; email: string; displayName?: string }

/** The names a user may call each account by; callers refuse a name several accounts share. */
export function getManagedAccountLookupNames(
  accounts: readonly NamedManagedAccount[]
): { id: string; names: (string | undefined)[] }[] {
  return accounts.map(({ id, email, displayName }) => ({ id, names: [email, displayName] }))
}

/** One-line labels keep the sign-in email beside a name so a re-pointed account can't pass as another. */
export function getManagedAccountInlineLabel(account: NamedAccount): string {
  const name = account.displayName?.trim()
  return name && name !== account.email ? `${name} (${account.email})` : account.email
}
