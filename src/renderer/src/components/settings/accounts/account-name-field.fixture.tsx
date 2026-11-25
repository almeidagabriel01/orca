import { defineFixture } from '../../../component-fixtures/component-fixture'
import {
  namedClaudeAccounts,
  namedCodexAccounts
} from '../../../component-fixtures/fixture-account-names'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import { SYSTEM_DEFAULT_ACCOUNT_NAME_KEY } from '../../../../../shared/agent-accounts/managed-account-display-names'
import type { AccountsPaneSectionModel } from './accounts-pane-types'
import { renamingAccountKey } from './account-rename-runner'
import { renderClaudeAccountsSection } from './claude/accounts-pane-claude-section'
import { renderCodexAccountsSection } from './codex/accounts-pane-codex-section'

const noop = (): void => {}
const noopAsync = async (): Promise<void> => {}
const HOST_TARGET = { runtime: 'host' as const, wslDistro: null }

function model(editingNameKey: string | null): AccountsPaneSectionModel {
  return {
    settings: getDefaultSettings('/home/dev'),
    accountOwner: { kind: 'local' },
    updateSettings: noop,
    updateSettingsOrThrow: noop,
    searchQuery: '',
    recordFeatureInteraction: noop,
    wslSupportedPlatform: false,
    wslAvailable: false,
    wslDistros: [],
    wslCapabilitiesLoading: false,
    localAccountRuntime: { runtime: 'host', label: 'This device' },
    localAccountRuntimeSentenceLabel: 'this device',
    isRemoteAccountScope: false,
    remoteServerName: null,
    remoteAccountScopeNotice: null,
    accountRuntime: { runtime: 'host', label: 'This device' },
    accountRuntimeSentenceLabel: 'this device',
    accountRuntimeUnavailable: false,
    accountVisibilityOptions: { remoteOwner: false, ownerPlatform: 'linux' },
    claudeAccounts: namedClaudeAccounts,
    claudeAction: 'idle',
    visibleClaudeAccounts: namedClaudeAccounts.accounts,
    systemClaudeActive: true,
    setRemoveClaudeTarget: noop,
    editingNameKey,
    setEditingNameKey: noop,
    renameAccount: noopAsync,
    renamingAccountKeys: new Set(),
    runClaudeAccountAction: noopAsync,
    codexAccounts: namedCodexAccounts,
    codexAction: 'idle',
    visibleCodexAccounts: namedCodexAccounts.accounts,
    systemCodexActive: true,
    systemCodexNeedsSignIn: false,
    systemCodexMissingSignIn: false,
    systemCodexIdentity: namedCodexAccounts.systemDefault,
    activeCodexAuthWarning: null,
    codexCliMissing: false,
    cliPresence: { installed: () => true, refresh: async () => [] },
    activeCodexAccountId: null,
    codexConfigSync: null,
    codexConfigSyncWarning: null,
    codexRateLimits: null,
    codexRateLimitTarget: HOST_TARGET,
    claudeAccountPlans: new Map(),
    codexAccountPlans: new Map(),
    setRemoveCodexTarget: noop,
    runCodexAccountAction: noopAsync,
    recordOpenCodeSettingEdit: noop
  }
}

function sections(editingNameKey: string | null): () => React.JSX.Element {
  return () => {
    const m = model(editingNameKey)
    return (
      <div className="space-y-6 bg-background p-5">
        {renderClaudeAccountsSection(m)}
        {renderCodexAccountsSection(m)}
      </div>
    )
  }
}

/** System default and one saved account per provider, each row showing its name. */
export const names = defineFixture({ width: 860, render: sections(null) })

/** Codex's System default name being edited inline. */
export const editingName = defineFixture({
  width: 860,
  render: sections(renamingAccountKey({ provider: 'codex', id: SYSTEM_DEFAULT_ACCOUNT_NAME_KEY }))
})
