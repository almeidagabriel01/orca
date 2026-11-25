import React from 'react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type {
  AntigravityAccountUsage,
  ProviderRateLimits
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { AccountSwitchList } from '../accounts/AccountSwitchList'
import { AccountSwitchRowItem } from '../accounts/AccountSwitchRowItem'
import { InlineUsageBars } from './InlineProviderUsage'
import { ProviderDetailsMenu } from './ProviderDetailsMenu'
import { formatTimeAgo } from './provider-usage-panel'
import { getAccountDisplayName } from '../../../../../shared/agent-accounts/managed-account-display-names'
import { resolveAccountName } from '../../../../../shared/agent-accounts/account-names'
import { useAppStore } from '../../../store/index'

/** Antigravity details plus each saved account's last verified reading; agy is never switched to read one. */
export function AntigravityUsageMenu({
  antigravity,
  accounts,
  triggerContent,
  onManageAccounts
}: {
  antigravity: ProviderRateLimits
  accounts: readonly AntigravityAccountUsage[]
  triggerContent: React.ReactNode
  onManageAccounts: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const accountNames = useAppStore((s) => s.settings?.accountNames)
  const nameOf = (account: { email?: string | null }): string =>
    getAccountDisplayName({
      displayName: resolveAccountName(accountNames, 'antigravity', account),
      email: account.email
    }) ?? t('auto.components.status.bar.antigravity.unknownAccount', 'Google account')
  const ariaLabel = t(
    'auto.components.status.bar.UsageRosterPanel.openDetails',
    'Open usage details'
  )
  if (accounts.length === 0) {
    return (
      <ProviderDetailsMenu
        provider={antigravity}
        asSubmenu
        triggerContent={triggerContent}
        ariaLabel={ariaLabel}
      />
    )
  }
  const account = antigravity.usageMetadata?.account
  return (
    <ProviderDetailsMenu
      provider={antigravity}
      asSubmenu
      triggerContent={triggerContent}
      ariaLabel={ariaLabel}
      variant="account"
      accountLabel={account ? nameOf(account) : undefined}
    >
      <AccountSwitchList
        showResetColumn
        heading={t('auto.components.status.bar.antigravity.accounts', 'Saved Antigravity Accounts')}
      >
        {accounts.map((entry) => (
          <AccountSwitchRowItem
            key={entry.accountId}
            label={nameOf(entry)}
            detail={
              entry.rateLimits
                ? t('auto.components.status.bar.antigravity.readAgo', 'Read {{time}}', {
                    time: formatTimeAgo(entry.rateLimits.updatedAt, t)
                  })
                : t('auto.components.status.bar.antigravity.notRead', 'Usage unknown: not read yet')
            }
            active={entry.active}
            onSelect={onManageAccounts}
          >
            {entry.rateLimits ? (
              <InlineUsageBars limits={entry.rateLimits} isFetching={false} />
            ) : null}
          </AccountSwitchRowItem>
        ))}
      </AccountSwitchList>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onManageAccounts}>
        {t('auto.components.status.bar.StatusBar.75ded02687', 'Manage Accounts…')}
      </DropdownMenuItem>
    </ProviderDetailsMenu>
  )
}
