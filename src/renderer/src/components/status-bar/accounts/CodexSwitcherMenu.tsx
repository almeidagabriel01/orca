import React from 'react'
import { CodexResetCredits, CodexResetConfirmation } from './CodexResetCredits'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { useTranslate } from '@/i18n/use-translate'
import {
  AccountRuntimeToggle,
  CodexRestartStatusPrompt
} from '../composition/StatusBarAccountControls'
import { ProviderDetailsMenu } from '../usage/ProviderDetailsMenu'
import { AccountManageLink } from './AccountSwitchList'
import { useCodexSwitcherController } from './use-codex-switcher-controller'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'
import { isCodexUsageSignInRequired } from '../../../../../shared/agent-accounts/codex/codex-auth-errors'
import { getCodexStatusRuntimeKey } from './status-bar-runtime-targets'
import { scopeCodexAuthFailure } from './status-bar-codex-accounts'
import type { AccountOwner } from '@/runtime/provider-accounts/ownership/wsl-host-account-owner'
import { getAccountOwnerKey } from './owner-account-rows'

type CodexSwitcherProps = {
  codex: ProviderRateLimits
  ownerUsage: OwnerUsageRateLimits
  asSubmenu?: boolean
  triggerContent?: React.ReactNode
}

export function CodexSwitcherMenu(props: CodexSwitcherProps): React.JSX.Element {
  const t = useTranslate()
  const owner = props.ownerUsage.owner
  if (!owner) {
    return (
      <ProviderDetailsMenu
        provider={props.codex}
        asSubmenu={props.asSubmenu}
        triggerContent={props.triggerContent}
        ariaLabel={t(
          'auto.components.status.bar.StatusBar.ba55303942',
          'Open Codex details and accounts'
        )}
      />
    )
  }
  return <CodexSwitcherForOwner {...props} owner={owner} key={getAccountOwnerKey(owner)} />
}

function CodexSwitcherForOwner({
  codex,
  ownerUsage,
  asSubmenu = false,
  triggerContent,
  owner
}: CodexSwitcherProps & { owner: AccountOwner }): React.JSX.Element {
  const t = useTranslate()
  const {
    activeTarget,
    canRedeemReset,
    confirmedResetAccountId,
    handleConfirmReset,
    handleOpenChange,
    handleResetMenuSelect,
    handleSelectRuntime,
    hasActiveRuntimeEnvironment,
    isRedeemingReset,
    open,
    openSettingsPage,
    openSettingsTarget,
    providerAccountHostLabel,
    resetConfirmOpen,
    rosterKnown,
    resetCreditCount,
    resetCreditExpiry,
    selectedGroup,
    selectedRuntimeKey,
    setResetConfirmOpen,
    setSkipFutureResetConfirm,
    skipFutureResetConfirm,
    switchGroups
  } = useCodexSwitcherController(codex, ownerUsage, owner)

  const signInRequired = codex.status === 'error' && isCodexUsageSignInRequired(codex)
  const authFailureAccount = codex.usageMetadata?.authFailureAccount
  const authFailureMatchesActive =
    authFailureAccount !== undefined &&
    activeTarget !== undefined &&
    authFailureAccount.accountId === activeTarget.id &&
    getCodexStatusRuntimeKey(authFailureAccount) ===
      getCodexStatusRuntimeKey(activeTarget.runtimeTarget)
  const displayedCodex = scopeCodexAuthFailure(
    codex,
    authFailureMatchesActive ? authFailureAccount.accountId : null
  )
  const activeSignInRequired = signInRequired && displayedCodex === codex
  const canSignInLocally = !hasActiveRuntimeEnvironment && authFailureMatchesActive
  return (
    <ProviderDetailsMenu
      provider={displayedCodex}
      asSubmenu={asSubmenu}
      triggerContent={triggerContent}
      ariaLabel={t(
        'auto.components.status.bar.StatusBar.ba55303942',
        'Open Codex details and accounts'
      )}
      variant="account"
      usageSignInHint={
        activeSignInRequired
          ? canSignInLocally
            ? t('accounts.codex.usageSignInMessage', 'Sign in to see usage.')
            : t('accounts.codex.usageSignInSettingsMessage', 'Open Settings → Accounts to sign in.')
          : undefined
      }
      accountLabel={
        rosterKnown
          ? (activeTarget?.label ?? t('accounts.ownLogin', "This computer's login"))
          : undefined
      }
      panelFooter={
        !signInRequired && resetCreditCount !== null ? (
          <CodexResetCredits
            unsupportedRuntime={
              owner.wslHostDistro !== null || selectedGroup?.runtimeTarget.runtime === 'wsl'
                ? 'wsl'
                : undefined
            }
            resetCreditCount={resetCreditCount}
            resetCreditExpiry={resetCreditExpiry}
            canRedeemReset={canRedeemReset}
            isRedeemingReset={isRedeemingReset}
            onReset={handleResetMenuSelect}
            renderAction={(action) => (
              <DropdownMenuItem
                asChild
                disabled={isRedeemingReset}
                onSelect={(event) => {
                  event.preventDefault()
                }}
              >
                {action}
              </DropdownMenuItem>
            )}
          />
        ) : undefined
      }
      topContent={
        !hasActiveRuntimeEnvironment && owner.wslHostDistro === null ? (
          <AccountRuntimeToggle
            groups={switchGroups}
            value={selectedRuntimeKey}
            onChange={(group) => void handleSelectRuntime(group)}
            ariaLabel={t('auto.components.status.bar.StatusBar.38b5647724', 'Codex usage runtime')}
          />
        ) : undefined
      }
      open={open}
      onOpenChange={handleOpenChange}
    >
      <CodexResetConfirmation
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        skipFutureResetConfirm={skipFutureResetConfirm}
        onSkipChange={setSkipFutureResetConfirm}
        isRedeemingReset={isRedeemingReset}
        onConfirm={handleConfirmReset}
        {...(providerAccountHostLabel
          ? {
              accountLabel: selectedGroup?.targets.find(
                (target) => target.id === confirmedResetAccountId
              )?.label,
              hostLabel: providerAccountHostLabel
            }
          : {})}
      />
      {/* Why: restarting sessions onto a login that needs signing in again would break them. */}
      {open && !signInRequired && displayedCodex.status !== 'fetching' ? (
        <CodexRestartStatusPrompt />
      ) : null}
      {/* Why: until the host lists its accounts, the empty roster's only row would claim "System default". */}
      {rosterKnown ? (
        <AccountManageLink
          onOpenSettings={() => {
            openSettingsTarget({
              pane: 'accounts',
              repoId: null,
              sectionId: 'accounts-codex',
              hostScope: owner.target
            })
            openSettingsPage()
          }}
        />
      ) : null}
    </ProviderDetailsMenu>
  )
}
