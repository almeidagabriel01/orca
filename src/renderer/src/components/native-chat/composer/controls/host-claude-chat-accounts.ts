import { useEffect, useState } from 'react'
import { fetchProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
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

/** The host's Claude accounts, or null until they load or when the host can't list them. */
export function useHostClaudeAccounts(
  target: RuntimeClientTarget
): ClaudeRateLimitAccountsState | null {
  const [state, setState] = useState<ClaudeRateLimitAccountsState | null>(null)
  useEffect(() => {
    let current = true
    fetchProviderAccountsSnapshot(target)
      .then((snapshot) => {
        if (current && !snapshot.failedProviders?.includes('claude')) {
          setState(snapshot.claude)
        }
      })
      .catch((error: unknown) => console.warn('[native-chat] Claude accounts unavailable', error))
    return () => {
      current = false
    }
  }, [target])
  return state
}
