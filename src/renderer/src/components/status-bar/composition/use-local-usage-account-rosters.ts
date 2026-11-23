import { useAppStore } from '../../../store/index'
import {
  emptyClaudeAccountsState,
  emptyCodexAccountsState
} from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import { useProviderAccountList } from '../accounts/use-provider-account-list'
import {
  getClaudeAccountSyncKey,
  getCodexAccountSyncKey
} from '../accounts/provider-account-sync-key'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

const LOCAL: RuntimeClientTarget = { kind: 'local' }
const EMPTY_CLAUDE = emptyClaudeAccountsState()
const EMPTY_CODEX = emptyCodexAccountsState()

/** This device's account rosters, which carry what Settings lacks, e.g. System default's login. */
export function useLocalUsageAccountRosters(enabled: boolean) {
  const claudeKey = useAppStore((s) => getClaudeAccountSyncKey(s.settings))
  const codexKey = useAppStore((s) => getCodexAccountSyncKey(s.settings))
  const claude = useProviderAccountList('claude', LOCAL, claudeKey, EMPTY_CLAUDE, enabled).accounts
  const codex = useProviderAccountList('codex', LOCAL, codexKey, EMPTY_CODEX, enabled).accounts
  return { claude, codex }
}
