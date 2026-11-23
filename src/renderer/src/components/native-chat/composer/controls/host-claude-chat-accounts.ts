import { useEffect, useState } from 'react'
import {
  fetchProviderAccountsSnapshot,
  type ProviderAccountsSnapshot
} from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { ClaudeRateLimitAccountsState } from '../../../../../../shared/agent-accounts/managed-account-types'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

export type ClaudeChatAccountRow = { value: string; label: string; description?: string }

/** The chat host's own Claude accounts; WSL accounts never run a native chat. */
export function claudeChatAccountRows(state: ClaudeRateLimitAccountsState): ClaudeChatAccountRow[] {
  return state.accounts
    .filter((account) => account.managedAuthRuntime !== 'wsl' && !account.needsSignIn)
    .map((account) => ({
      value: account.id,
      label: account.displayName ?? account.email,
      ...(account.organizationName ? { description: account.organizationName } : {})
    }))
}

/** The account Codex runs on for the host, as people read it; null when the host can't say. */
export function codexHostAccountLabel(snapshot: ProviderAccountsSnapshot | null): string | null {
  if (!snapshot || snapshot.failedProviders?.includes('codex')) {
    return null
  }
  const { codex } = snapshot
  const active = codex.accounts.find((account) => account.id === codex.activeAccountId)
  return active ? (active.displayName ?? active.email) : (codex.systemDefault?.email ?? null)
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
