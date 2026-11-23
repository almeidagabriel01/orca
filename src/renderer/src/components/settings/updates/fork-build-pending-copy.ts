import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { ForkBuildPending } from '../../../../../shared/updater/update-status-types'

/** Never "up to date" while upstream has a release the fork has not built. */
export function forkBuildPendingCopy(pending: ForkBuildPending, t: Translate = translate): string {
  return pending.failure
    ? t(
        'auto.components.settings.GeneralUpdateSettingsSection.forkBuildFailed',
        'Orca {{version}} is out, but the fork build failed. It is being fixed; check again later.',
        { version: pending.version }
      )
    : t(
        'auto.components.settings.GeneralUpdateSettingsSection.forkBuildPending',
        'Orca {{version}} is out. The fork build is being made; check again in a few minutes.',
        { version: pending.version }
      )
}
