/** Which saved Claude/Codex accounts the status bar usage row shows: the active one, or every account read. */
export type StatusBarUsageAccounts = 'active' | 'all'

export const DEFAULT_STATUS_BAR_USAGE_ACCOUNTS: StatusBarUsageAccounts = 'active'

export function normalizeStatusBarUsageAccounts(value: unknown): StatusBarUsageAccounts {
  return value === 'all' ? 'all' : DEFAULT_STATUS_BAR_USAGE_ACCOUNTS
}
