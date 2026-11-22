import { useAppStore } from '../../../store/index'
import { normalizeStatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'
import { normalizeStatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'

/** The usage row's density and accounts settings; main polls every saved account's usage. */
export function useStatusBarUsagePreferences() {
  const statusBarUsageMode = normalizeStatusBarUsageMode(useAppStore((s) => s.statusBarUsageMode))
  const setStatusBarUsageMode = useAppStore((s) => s.setStatusBarUsageMode)
  const statusBarUsageAccounts = normalizeStatusBarUsageAccounts(
    useAppStore((s) => s.statusBarUsageAccounts)
  )
  const setStatusBarUsageAccounts = useAppStore((s) => s.setStatusBarUsageAccounts)
  return {
    statusBarUsageMode,
    setStatusBarUsageMode,
    statusBarUsageAccounts,
    setStatusBarUsageAccounts
  }
}
