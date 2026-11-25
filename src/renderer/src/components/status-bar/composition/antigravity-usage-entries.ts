import { resolveAccountName } from '../../../../../shared/agent-accounts/account-names'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import type { Translate } from '@/i18n/use-translate'
import type { OwnerUsageRateLimits } from '../usage/use-owner-usage-rate-limits'
import type { UsageAccountEntry } from './status-bar-usage-chips'

/** Antigravity's saved accounts, named by the user's global name for each login. */
export function getAntigravityUsageEntries(
  rateLimits: OwnerUsageRateLimits['rateLimits'],
  settings: Pick<GlobalSettings, 'accountNames'> | null,
  t: Translate
): UsageAccountEntry[] {
  const live = rateLimits.antigravity?.usageMetadata?.account
  return rateLimits.antigravityAccounts.map((account) => {
    const email = account.email ?? (account.active ? live?.email : null)
    return {
      key: account.accountId,
      selected: account.active,
      reading: account.rateLimits,
      name: {
        displayName: resolveAccountName(settings?.accountNames, 'antigravity', { email }),
        email
      },
      fallbackLabel: t('auto.components.status.bar.antigravity.unknownAccount', 'Google account')
    }
  })
}
