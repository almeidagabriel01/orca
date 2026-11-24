import { useEffect, useState } from 'react'
import type { CodexConfigSyncStatus } from '../../../../../../shared/agent-accounts/codex/codex-config-sync-types'
import { watchCodexConfigSyncStatus } from '../../../../runtime/provider-accounts/codex-config-sync-observer'

/** An unusable ~/.codex leaves the mirror serving stale settings; surface why edits are ignored. */
export function useCodexConfigSync(
  isRemoteAccountScope: boolean,
  runtime: 'host' | 'wsl',
  activeCodexAccountId: string | null,
  codexAccountsLoaded: boolean
): CodexConfigSyncStatus | null {
  const [codexConfigSync, setCodexConfigSync] = useState<CodexConfigSyncStatus | null>(null)
  useEffect(() => {
    // Sync status describes local host homes; WSL/remote scopes mirror unrelated homes.
    if (isRemoteAccountScope || runtime !== 'host') {
      setCodexConfigSync(null)
      return
    }
    // Retry transient managed-home locks serially; lock release changes no effect dependency and overlapping polls could apply stale results.
    return watchCodexConfigSyncStatus(setCodexConfigSync)
    // Selection changes choose a different mirrored home; refetch rather than describe the previous account.
  }, [isRemoteAccountScope, runtime, activeCodexAccountId, codexAccountsLoaded])
  return codexConfigSync
}
