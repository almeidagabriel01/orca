import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { useHandoffDestinations } from '@/components/agent-session-continuation/use-handoff-destinations'
import { aiVaultCopyContinueDestination } from '../session-actions/ai-vault-session-other-machine'
import { VaultSessionRow } from './AiVaultSessionRow'

type SyncedCopyRowProps = React.ComponentProps<typeof VaultSessionRow> & {
  /** A synced copy's recording-host workspace; the hand-off dialog lists destinations from it. */
  handoffSourceWorktreeId: string | null
  onContinueOnHost: (environmentKey: string) => void
}

/** A session row; only a synced copy's watches the hosts it could continue on. */
export function AiVaultSessionRowSlot({
  handoffSourceWorktreeId,
  onContinueOnHost,
  ...row
}: SyncedCopyRowProps): React.JSX.Element {
  return handoffSourceWorktreeId ? (
    <SyncedCopySessionRow
      {...row}
      handoffSourceWorktreeId={handoffSourceWorktreeId}
      onContinueOnHost={onContinueOnHost}
    />
  ) : (
    <VaultSessionRow {...row} />
  )
}

/** Offers "Continue on <host>" where the copy's project is set up besides its recording host. */
function SyncedCopySessionRow({
  handoffSourceWorktreeId,
  onContinueOnHost,
  ...row
}: SyncedCopyRowProps & { handoffSourceWorktreeId: string }): React.JSX.Element {
  const t = useTranslate()
  const destination = aiVaultCopyContinueDestination(
    useHandoffDestinations(handoffSourceWorktreeId)
  )
  return destination ? (
    <VaultSessionRow
      {...row}
      onContinueInNewSession={() => onContinueOnHost(destination.key)}
      continueLabel={t(
        'components.agentSessionContinuation.continueOnHost',
        'Continue on {{host}}',
        {
          host: destination.hostLabel
        }
      )}
    />
  ) : (
    <VaultSessionRow {...row} />
  )
}
