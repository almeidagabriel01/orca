import { ArrowRightLeft } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useHandoffDestinations } from '@/components/agent-session-continuation/use-handoff-destinations'
import {
  handoffBlockText,
  handoffRowDetail
} from '@/components/agent-session-continuation/HandoffEnvironmentField'
import { isPickableHandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { NativeChatHandOffTarget } from './use-native-chat-hand-off'

/** "Continue on <host>" for each other host: opens the hand-off with that Environment preselected. */
export function NativeChatContinueOnHostItems({
  worktreeId,
  hostId,
  handOff
}: {
  worktreeId: string
  hostId: ExecutionHostId
  handOff: NativeChatHandOffTarget
}): React.JSX.Element | null {
  const t = useTranslate()
  const destinations = useHandoffDestinations(worktreeId, hostId)
  const others = destinations?.filter((row) => row.kind !== 'current') ?? []
  if (others.length === 0) {
    return null
  }
  return (
    <>
      {others.map((row) => (
        <DropdownMenuItem
          key={row.key}
          disabled={handOff.disabled || !isPickableHandoffDestination(row)}
          onSelect={() => handOff.openTo(row.key)}
        >
          <ArrowRightLeft />
          <span className="grid min-w-0 flex-1 gap-0.5 py-0.5">
            <span className="truncate font-medium">
              {t('components.agentSessionContinuation.continueOnHost', 'Continue on {{host}}', {
                host: row.hostLabel
              })}
            </span>
            <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
              {row.block && row.block.kind !== 'branch-missing'
                ? handoffBlockText(t, row.block)
                : row.block
                  ? `${t('components.agentSessionContinuation.movesConversation', 'Moves this conversation there')} · ${handoffRowDetail(t, row)}`
                  : t(
                      'components.agentSessionContinuation.movesConversation',
                      'Moves this conversation there'
                    )}
            </span>
          </span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
