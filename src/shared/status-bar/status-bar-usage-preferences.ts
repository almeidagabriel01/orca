import type { PersistedUIState } from '../orca-profiles/persisted-ui-state-types'
import { normalizeUsagePercentageDisplay } from '../agent-usage/display/usage-percentage-display'
import { normalizeStatusBarUsageMode } from './status-bar-usage-mode'
import { normalizeStatusBarUsageAccounts } from './status-bar-usage-accounts'
import { normalizeStatusBarUsageFormat } from './status-bar-usage-format'

type StatusBarUsagePreferences = Required<
  Pick<
    PersistedUIState,
    | 'usagePercentageDisplay'
    | 'statusBarUsageMode'
    | 'statusBarUsageAccounts'
    | 'statusBarUsageFormat'
  >
>

/** The status bar usage row's presentation preferences, each normalized from persisted UI state. */
export function normalizeStatusBarUsagePreferences(
  ui: Partial<StatusBarUsagePreferences>
): StatusBarUsagePreferences {
  return {
    usagePercentageDisplay: normalizeUsagePercentageDisplay(ui.usagePercentageDisplay),
    statusBarUsageMode: normalizeStatusBarUsageMode(ui.statusBarUsageMode),
    statusBarUsageAccounts: normalizeStatusBarUsageAccounts(ui.statusBarUsageAccounts),
    statusBarUsageFormat: normalizeStatusBarUsageFormat(ui.statusBarUsageFormat)
  }
}
