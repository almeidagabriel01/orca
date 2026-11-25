import { Loader2, Plus, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { selectClaudeProviderAccount } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import { Button } from '../../../ui/button'
import { ButtonGroup } from '../../../ui/button-group'
import { Label } from '../../../ui/label'
import { ClaudeIcon } from '../../../status-bar/accounts/provider-icons'
import { SearchableSetting } from '../../section-layout/SearchableSetting'
import { ClaudeOAuthUsageSetting } from './claude-oauth-usage-setting'
import { ClaudeRunningSessionSwitchSetting } from './claude-running-session-switch-setting'
import type { AccountsPaneSectionModel } from '../accounts-pane-types'
import {
  canOfferClaudeSignInLink,
  ClaudeSignInLinkMenu,
  withCopiedClaudeLink
} from './claude-sign-in-link-menu'
import { signInClaudeAccountOnHost } from '@/runtime/provider-accounts/sign-in/runtime-host-account-sign-in-client'
import { HostAccountSignInPrompt } from '../sign-in/HostAccountSignInPrompt'
import {
  accountAdditionShownInPrompt,
  cancelAccountAddition,
  trackAccountAddition
} from '../sign-in/account-add-cancel-target'
import { SettingsGroup } from '../../section-layout/SettingsGroup'
import { ProviderNotInstalledSection } from '../provider-not-installed'
import { providerSignInState } from '../../../../lib/provider-accounts/provider-cli-presence'
import { renderClaudeAccountRow } from './accounts-pane-claude-account-row'
import {
  getAccountDisplayName,
  SYSTEM_DEFAULT_ACCOUNT_NAME_KEY
} from '../../../../../../shared/agent-accounts/managed-account-display-names'
import { OwnLoginCard } from '../own-login-card'

export function renderClaudeAccountsSection(
  model: AccountsPaneSectionModel,
  t: Translate = translate,
  intlLocale?: string
): React.JSX.Element {
  const {
    accountRuntime,
    accountRuntimeSentenceLabel,
    accountRuntimeUnavailable,
    claudeAccounts,
    claudeAction,
    cliPresence,
    isRemoteAccountScope,
    recordFeatureInteraction,
    remoteAccountScopeNotice,
    runClaudeAccountAction,
    settings,
    accountOwner,
    systemClaudeActive,
    updateSettings,
    visibleClaudeAccounts,
    wslCapabilitiesLoading
  } = model
  // The host's own login belongs to the host home, never a WSL distro.
  const systemDefaultEmail =
    accountRuntime.runtime === 'host' ? claudeAccounts.systemDefaultEmail : undefined
  // The name belongs to the host's own login, so a WSL distro's login has none.
  const systemDefaultName =
    accountRuntime.runtime === 'host' ? claudeAccounts.systemDefaultDisplayName : undefined
  const systemNameTarget = { provider: 'claude' as const, id: SYSTEM_DEFAULT_ACCOUNT_NAME_KEY }
  // Warn only with copy evidence; saving one’s own login as an account is normal.
  const systemDefaultIsSaved =
    !!systemDefaultEmail &&
    claudeAccounts.systemDefaultMayBeCopied === true &&
    !settings.claudeCopiedSystemDefaultNoticeDismissed &&
    claudeAccounts.accounts.some(
      (account) => account.email.toLowerCase() === systemDefaultEmail.toLowerCase()
    )
  const addDisabled = claudeAction !== 'idle' || wslCapabilitiesLoading || accountRuntimeUnavailable
  // Remote additions must run login on the account owner rather than this device.
  const addClaudeAccount = (copyLink: boolean): Promise<void> =>
    runClaudeAccountAction('adding', () =>
      trackAccountAddition('claude', accountOwner, () =>
        accountOwner.kind === 'environment'
          ? signInClaudeAccountOnHost(accountOwner)
          : withCopiedClaudeLink(
              copyLink,
              window.api.claudeAccounts.add({
                runtime: accountRuntime.runtime,
                wslDistro: accountRuntime.wslDistro,
                copyLink
              })
            )
      )
    )
  const title = (
    <span className="flex items-center gap-2">
      <ClaudeIcon size={16} />
      {t('auto.components.settings.AccountsPane.26ef4b55be', 'Claude')}
    </span>
  )
  // Saved accounts or a working login keep the section usable even without a listed CLI.
  const hasLogin = visibleClaudeAccounts.length > 0 || !!systemDefaultEmail
  if (providerSignInState(cliPresence.installed('claude'), !hasLogin) === 'not-installed') {
    return (
      <ProviderNotInstalledSection
        key="claude-accounts"
        id="accounts-claude"
        title={title}
        agent="claude"
        hostLabel={model.accountRuntimeSentenceLabel}
        onCheckAgain={() => void cliPresence.refresh()}
      />
    )
  }
  return (
    <div key="claude-accounts" id="accounts-claude" className="scroll-mt-6">
      <SettingsGroup
        title={title}
        description={t(
          'auto.components.settings.AccountsPane.72b36ea174',
          'Optional. Orca can use your normal Claude login; add accounts only if you want quick switching without moving chat sessions.'
        )}
      >
        <SearchableSetting
          title={t('auto.components.settings.AccountsPane.89b9a151c3', 'Claude accounts')}
          description={t(
            'accounts.claude.profileSwitching',
            'Switching applies to the next Claude you start in any tab.'
          )}
          keywords={['claude', 'account', 'rate limit', 'status bar', 'quota']}
          className="space-y-3 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label>{t('auto.components.settings.AccountsPane.94d351af4a', 'Accounts')}</Label>
              <p className="text-xs text-muted-foreground">
                {isRemoteAccountScope
                  ? t(
                      'accounts.remoteScopeAccountsAddHere',
                      'Showing accounts managed by {{value0}}. New accounts sign in there; you finish in this device’s browser.',
                      { value0: accountRuntimeSentenceLabel }
                    )
                  : t(
                      'auto.components.settings.AccountsPane.c0a52abfc5',
                      'Showing accounts for {{value0}}. New accounts are added there.',
                      { value0: accountRuntimeSentenceLabel }
                    )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void addClaudeAccount(false)}
                  disabled={addDisabled}
                  className="gap-1.5"
                >
                  {claudeAction === 'adding' ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  {t('auto.components.settings.AccountsPane.7e9977b560', 'Add account')}
                </Button>
                {!isRemoteAccountScope && canOfferClaudeSignInLink(accountRuntime.runtime) ? (
                  <ClaudeSignInLinkMenu
                    variant="outline"
                    disabled={addDisabled}
                    onCopyLink={() => void addClaudeAccount(true)}
                  />
                ) : null}
              </ButtonGroup>
              {/* Follow the running addition; hide Cancel only when its server prompt already offers it. */}
              {claudeAction === 'adding' &&
              !accountAdditionShownInPrompt('claude', accountOwner) ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    void cancelAccountAddition('claude', () =>
                      window.api.claudeAccounts.cancelPendingLogin()
                    )
                  }
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                  {t('auto.components.settings.AccountsPane.dbb9626ed1', 'Cancel')}
                </Button>
              ) : null}
            </div>
          </div>
          {remoteAccountScopeNotice}
          {isRemoteAccountScope ? (
            <HostAccountSignInPrompt
              owner={accountOwner}
              provider="claude"
              hostLabel={accountRuntimeSentenceLabel}
            />
          ) : null}

          <div className="space-y-2">
            <OwnLoginCard
              model={model}
              target={systemNameTarget}
              account={{ displayName: systemDefaultName, email: systemDefaultEmail }}
              name={getAccountDisplayName({
                displayName: systemDefaultName,
                email: systemDefaultEmail
              })}
              active={systemClaudeActive}
              t={t}
              cardClassName={
                systemClaudeActive
                  ? 'border-foreground/20 bg-accent/15'
                  : 'border-border/70 hover:border-border hover:bg-accent/8'
              }
              disabled={claudeAction !== 'idle' || accountRuntimeUnavailable}
              canRename={accountRuntime.runtime === 'host'}
              onSelect={() =>
                void runClaudeAccountAction('select:system', () =>
                  selectClaudeProviderAccount(accountOwner, {
                    accountId: null,
                    runtime: accountRuntime.runtime,
                    wslDistro: accountRuntime.wslDistro
                  })
                )
              }
              detail={
                <span className="truncate text-[11px] text-muted-foreground">
                  {systemDefaultEmail ? `${systemDefaultEmail} • ` : null}
                  {t(
                    'auto.components.settings.AccountsPane.e05d0ff737',
                    "Uses {{value0}}'s Claude login.",
                    { value0: accountRuntimeSentenceLabel }
                  )}
                </span>
              }
            />
            {systemDefaultIsSaved ? (
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t(
                    'accounts.claude.ownLoginIsSaved',
                    "This computer's Claude login is signed in as {{value0}}, which is also a saved account. An earlier Orca version may have copied that login there. If it is not your own login, select the row above and run claude /login.",
                    { value0: systemDefaultEmail }
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => updateSettings({ claudeCopiedSystemDefaultNoticeDismissed: true })}
                >
                  {t('accounts.claude.systemDefaultIsSavedDismiss', 'Dismiss')}
                </Button>
              </div>
            ) : null}
            {visibleClaudeAccounts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                {isRemoteAccountScope
                  ? t(
                      'auto.components.settings.AccountsPane.remoteEmptyClaudeOwnLogin',
                      'No managed Claude accounts on {{value0}}. It uses its own Claude login; add accounts on that server.',
                      { value0: accountRuntimeSentenceLabel }
                    )
                  : t(
                      'auto.components.settings.AccountsPane.emptyClaudeOwnLogin',
                      "No managed Claude accounts for {{value0}}. Orca will use that environment's own Claude login until you add one here.",
                      { value0: accountRuntimeSentenceLabel }
                    )}
              </div>
            ) : (
              visibleClaudeAccounts.map((account) =>
                renderClaudeAccountRow(account, model, t, intlLocale)
              )
            )}
          </div>
        </SearchableSetting>
        {isRemoteAccountScope ? null : (
          <ClaudeOAuthUsageSetting
            settings={settings}
            updateSettings={updateSettings}
            recordFeatureInteraction={recordFeatureInteraction}
          />
        )}
        {isRemoteAccountScope ? null : (
          <ClaudeRunningSessionSwitchSetting settings={settings} updateSettings={updateSettings} />
        )}
      </SettingsGroup>
    </div>
  )
}
