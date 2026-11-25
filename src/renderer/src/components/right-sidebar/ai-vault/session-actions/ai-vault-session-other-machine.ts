import { translate } from '@/i18n/i18n'

/** The host badge of a copy synced from another computer, listed only while that computer's own row is missing. */
export function aiVaultOtherMachineLabel(): string {
  return translate(
    'aiVault.recordedOnOtherMachineCopy',
    'Recorded on another computer · open it there'
  )
}
