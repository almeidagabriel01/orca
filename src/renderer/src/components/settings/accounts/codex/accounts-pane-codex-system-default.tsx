import type { Translate } from '@/i18n/use-translate'
import { selectCodexProviderAccount } from '@/runtime/provider-accounts/observations/runtime-provider-account-selection'
import { Badge } from '../../../ui/badge'
import { getCodexSystemDefaultSubtitle } from '../scope/accounts-pane-runtime'
import {
  clearsHiddenWslLanes,
  getSystemDefaultLanes,
  runSystemDefaultSelect,
  systemDefaultCandidates
} from '../scope/system-default-lanes'
import type { AccountsPaneSectionModel } from '../accounts-pane-types'
import { OwnLoginCard } from '../own-login-card'
import {
  getAccountDisplayName,
  SYSTEM_DEFAULT_ACCOUNT_NAME_KEY
} from '../../../../../../shared/agent-accounts/managed-account-display-names'

export function renderCodexSystemDefaultButton(
  model: AccountsPaneSectionModel,
  t: Translate
): React.JSX.Element {
  const {
    accountOwner,
    accountRuntime,
    accountRuntimeSentenceLabel,
    accountRuntimeUnavailable,
    accountVisibilityOptions,
    codexAccounts,
    codexAction,
    isRemoteAccountScope,
    runCodexAccountAction,
    systemCodexActive,
    systemCodexIdentity,
    systemCodexMissingSignIn,
    systemCodexNeedsSignIn,
    visibleCodexAccounts
  } = model
  const systemDefaultLanes = getSystemDefaultLanes(
    accountRuntime,
    systemDefaultCandidates(codexAccounts.accounts, visibleCodexAccounts, accountVisibilityOptions),
    codexAccounts,
    isRemoteAccountScope
  )
  // The name belongs to the host's own login, so a WSL distro's login has none.
  const systemDefaultName =
    accountRuntime.runtime === 'host' ? codexAccounts.systemDefaultDisplayName : undefined
  const systemDefaultShortName =
    accountRuntime.runtime === 'host'
      ? getAccountDisplayName({ displayName: systemDefaultName, email: systemCodexIdentity?.email })
      : undefined
  return (
    <OwnLoginCard
      model={model}
      target={{ provider: 'codex', id: SYSTEM_DEFAULT_ACCOUNT_NAME_KEY }}
      account={{ displayName: systemDefaultName, email: systemCodexIdentity?.email }}
      name={systemDefaultShortName}
      active={systemCodexActive}
      t={t}
      cardClassName={
        systemCodexNeedsSignIn
          ? 'border-destructive/50 bg-destructive/5'
          : systemCodexActive
            ? 'border-foreground/20 bg-accent/15'
            : 'border-border/70 hover:border-border hover:bg-accent/8'
      }
      disabled={codexAction !== 'idle' || accountRuntimeUnavailable}
      canRename={accountRuntime.runtime === 'host'}
      onSelect={() =>
        void runSystemDefaultSelect(
          systemDefaultLanes,
          accountOwner,
          runCodexAccountAction,
          selectCodexProviderAccount
        )
      }
      badges={
        systemCodexNeedsSignIn ? (
          <Badge
            variant="destructive"
            className="h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none"
          >
            {t('auto.components.settings.AccountsPane.93c47b333a', 'Needs sign-in')}
          </Badge>
        ) : null
      }
      detail={
        <span
          className={`truncate text-[11px] ${
            systemCodexNeedsSignIn ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {systemCodexNeedsSignIn
            ? systemCodexMissingSignIn
              ? t(
                  'auto.components.settings.AccountsPane.codexSystemDefaultNeedsSignIn',
                  'No Codex sign-in was found for {{value0}}.',
                  { value0: accountRuntimeSentenceLabel }
                )
              : t(
                  'auto.components.settings.AccountsPane.fd62f37c24',
                  'Codex reported this {{value0}} login is out of date.',
                  { value0: accountRuntimeSentenceLabel }
                )
            : getCodexSystemDefaultSubtitle(
                systemCodexIdentity,
                accountRuntimeSentenceLabel,
                t,
                clearsHiddenWslLanes(systemDefaultLanes)
              )}
        </span>
      }
    />
  )
}
