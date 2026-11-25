import { useEffect, useState } from 'react'
import {
  fetchProviderAccountsSnapshot,
  type ProviderAccountsSnapshot
} from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import {
  getAccountDisplayName,
  getSystemDefaultDisplayName
} from '../../../../../../shared/agent-accounts/managed-account-display-names'
import type { ClaudeRateLimitAccountsState } from '../../../../../../shared/agent-accounts/managed-account-types'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  AGENT_CHAT_SYSTEM_ACCOUNT
} from '../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

export type ClaudeChatAccountRow = {
  value: string
  label: string
  description?: string
  email?: string
}

/** The chat host's own Claude accounts; WSL accounts never run a native chat. */
export function claudeChatAccountRows(state: ClaudeRateLimitAccountsState): ClaudeChatAccountRow[] {
  return state.accounts
    .filter((account) => account.managedAuthRuntime !== 'wsl' && !account.needsSignIn)
    .map((account) => ({
      value: account.id,
      label: getAccountDisplayName(account) ?? account.email,
      email: account.email,
      ...(account.organizationName ? { description: account.organizationName } : {})
    }))
}

export type ClaudeChoiceRow = ClaudeChatAccountRow & {
  /** The account the host uses now: what a chat following the host runs on. */
  isDefault: boolean
}

/**
 * Every account a Claude chat can pin, the host's own login included, and the row the chat's
 * choice shows as: following the host reads as the default account's row.
 * `ownLogin` names the host's own login when it has neither nickname nor email.
 */
export function claudeChoiceRows(
  state: ClaudeRateLimitAccountsState,
  choice: string | undefined,
  ownLogin: string
): { rows: ClaudeChoiceRow[]; value: string } {
  const saved = claudeChatAccountRows(state)
  const systemEmail = state.systemDefaultEmail
  // A saved account signed in to the same login already stands for it.
  const systemMatch = systemEmail ? saved.find((row) => row.email === systemEmail) : undefined
  const defaultValue = state.activeAccountId ?? systemMatch?.value ?? AGENT_CHAT_SYSTEM_ACCOUNT
  const own: ClaudeChoiceRow[] = systemMatch
    ? []
    : [
        {
          value: AGENT_CHAT_SYSTEM_ACCOUNT,
          label: getSystemDefaultDisplayName(state) ?? ownLogin,
          ...(systemEmail ? { email: systemEmail } : {}),
          isDefault: defaultValue === AGENT_CHAT_SYSTEM_ACCOUNT
        }
      ]
  const rows = [...own, ...saved.map((row) => ({ ...row, isDefault: row.value === defaultValue }))]
  const wanted = choice ?? AGENT_CHAT_HOST_ACCOUNT
  const value =
    wanted === AGENT_CHAT_HOST_ACCOUNT
      ? defaultValue
      : wanted === AGENT_CHAT_SYSTEM_ACCOUNT && systemMatch
        ? systemMatch.value
        : wanted
  return { rows, value }
}

/** The account Codex runs on for the host, as people read it; null when the host can't say. */
export function codexHostAccountLabel(snapshot: ProviderAccountsSnapshot | null): string | null {
  if (!snapshot || snapshot.failedProviders?.includes('codex')) {
    return null
  }
  const { codex } = snapshot
  const active = codex.accounts.find((account) => account.id === codex.activeAccountId)
  return (active ? getAccountDisplayName(active) : getSystemDefaultDisplayName(codex)) ?? null
}

/** The host's provider accounts, or null until they load or when the host can't list them. */
export function useHostProviderAccounts(
  target: RuntimeClientTarget
): ProviderAccountsSnapshot | null {
  const [snapshot, setSnapshot] = useState<ProviderAccountsSnapshot | null>(null)
  useEffect(() => {
    let current = true
    fetchProviderAccountsSnapshot(target)
      .then((next) => {
        if (current) {
          setSnapshot(next)
        }
      })
      .catch((error: unknown) => console.warn('[native-chat] Provider accounts unavailable', error))
    return () => {
      current = false
    }
  }, [target])
  return snapshot
}

/** The host's Claude accounts, or null until they load or when the host can't list them. */
export function useHostClaudeAccounts(
  target: RuntimeClientTarget
): ClaudeRateLimitAccountsState | null {
  const snapshot = useHostProviderAccounts(target)
  return snapshot && !snapshot.failedProviders?.includes('claude') ? snapshot.claude : null
}
