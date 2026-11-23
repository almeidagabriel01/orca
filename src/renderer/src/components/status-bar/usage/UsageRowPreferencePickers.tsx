import { SettingsSegmentedControl } from '@/components/settings/form-controls/SettingsFormControls'
import { useTranslate } from '@/i18n/use-translate'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import type { StatusBarUsageAccounts } from '../../../../../shared/status-bar/status-bar-usage-accounts'

/** The usage row's density and, where saved accounts could add chips, which accounts it shows. */
export function UsageRowPreferencePickers({
  statusBarUsageMode,
  onStatusBarUsageModeChange,
  usageAccounts,
  onUsageAccountsChange
}: {
  statusBarUsageMode: StatusBarUsageMode
  onStatusBarUsageModeChange: (mode: StatusBarUsageMode) => void
  usageAccounts?: StatusBarUsageAccounts
  onUsageAccountsChange?: (accounts: StatusBarUsageAccounts) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    // Keep the pickers in the popover so every usage row form is discoverable.
    <div className="flex flex-col gap-1.5 px-3.5 pb-2.5">
      <SettingsSegmentedControl<StatusBarUsageMode>
        value={statusBarUsageMode}
        onChange={onStatusBarUsageModeChange}
        ariaLabel={t(
          'auto.components.status.bar.UsageRosterPanel.footerDetailAria',
          'Usage footer detail'
        )}
        size="sm"
        equalWidth
        options={[
          {
            value: 'verbose',
            label: t('auto.components.status.bar.UsageRosterPanel.detailed', 'Detailed'),
            tooltip: t(
              'auto.components.status.bar.UsageRosterPanel.detailedTooltip',
              'Full usage with bars, labels, and percentages'
            )
          },
          {
            value: 'compact',
            label: t('auto.components.status.bar.UsageRosterPanel.compact', 'Compact'),
            tooltip: t(
              'auto.components.status.bar.UsageRosterPanel.compactTooltip',
              'Condensed usage: one summary per provider'
            )
          }
        ]}
      />
      {usageAccounts && onUsageAccountsChange ? (
        <SettingsSegmentedControl<StatusBarUsageAccounts>
          value={usageAccounts}
          onChange={onUsageAccountsChange}
          ariaLabel={t('components.status-bar.usage.accounts.aria', 'Accounts in the status bar')}
          size="sm"
          equalWidth
          options={[
            {
              value: 'active',
              label: t('components.status-bar.usage.accounts.active', 'Active account'),
              tooltip: t(
                'components.status-bar.usage.accounts.activeTooltip',
                'One chip per agent, for the account it runs on'
              )
            },
            {
              value: 'all',
              label: t('components.status-bar.usage.accounts.all', 'All accounts'),
              tooltip: t(
                'components.status-bar.usage.accounts.allTooltip',
                'One chip and row per saved account of each agent'
              )
            }
          ]}
        />
      ) : null}
    </div>
  )
}
