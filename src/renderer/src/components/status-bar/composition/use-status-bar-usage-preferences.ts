import { useCallback, useEffect } from 'react'
import { useAppStore } from '../../../store/index'
import { normalizeStatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'
import { normalizeStatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'

/** The usage row's density and accounts settings, and the reads of inactive accounts 'all' needs. */
export function useStatusBarUsagePreferences(statusBarVisible: boolean, remoteOwned: boolean) {
  const statusBarUsageMode = normalizeStatusBarUsageMode(useAppStore((s) => s.statusBarUsageMode))
  const setStatusBarUsageMode = useAppStore((s) => s.setStatusBarUsageMode)
  const statusBarUsageAccounts = normalizeStatusBarUsageAccounts(
    useAppStore((s) => s.statusBarUsageAccounts)
  )
  const setStatusBarUsageAccounts = useAppStore((s) => s.setStatusBarUsageAccounts)
  const fetchClaude = useAppStore((s) => s.fetchInactiveClaudeAccountUsage)
  const fetchCodex = useAppStore((s) => s.fetchInactiveCodexAccountUsage)
  // Why: a remote owner's readings ride its accounts stream, which its own refresh re-reads.
  const readsAll = statusBarVisible && statusBarUsageAccounts === 'all' && !remoteOwned
  // Why: inactive accounts are read on demand (main debounces), so 'all' asks once it is shown.
  // ponytail: readings refresh on show, Refresh and switcher open; add a slow poll if they go stale.
  const refreshInactiveAccounts = useCallback(async () => {
    if (readsAll) {
      await Promise.all([fetchClaude(), fetchCodex()])
    }
  }, [readsAll, fetchClaude, fetchCodex])
  useEffect(() => {
    void refreshInactiveAccounts()
  }, [refreshInactiveAccounts])
  return {
    statusBarUsageMode,
    setStatusBarUsageMode,
    statusBarUsageAccounts,
    setStatusBarUsageAccounts,
    refreshInactiveAccounts
  }
}
