import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import {
  handoffContinuationUnreachable,
  openHandoffContinuation,
  useHandoffContinuationPlace
} from '@/lib/agent-session/launch/continuation/handoff-continued-on'
import { useStructuredConversationContinuedTo } from '@/runtime/native-chat/naming/structured-conversation-name'
import { executionHostIdForStructuredTarget } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import type { NativeChatStructuredViewProps } from '../../native-chat-view-types'
import type { AgentSessionContinuedTo } from '../../../../../../shared/agent-session/lifecycle/records/agent-session-continued-to'
import { PaneTopBanner } from '../../../terminal-pane/appearance/pane-top-banner/PaneTopWarningBanner'
import { NativeChatHandOffContext, type NativeChatHandOffTarget } from './use-native-chat-hand-off'

/** The composer, or, once the chat was handed off to another host, where it went: one live chat per conversation. */
export function NativeChatComposerSlot({
  footer,
  pane,
  children
}: {
  footer: NativeChatHandOffTarget | null
  pane: Pick<NativeChatStructuredViewProps, 'sessionId' | 'target'>
  children: ReactNode
}): React.JSX.Element {
  // The source host's record carries the mark, so every client sees the chat as handed off.
  const continuedTo = useStructuredConversationContinuedTo(
    executionHostIdForStructuredTarget(pane.target),
    pane.sessionId
  )
  return continuedTo ? (
    <NativeChatContinuedOnBanner continuedTo={continuedTo} />
  ) : (
    <NativeChatHandOffContext.Provider value={footer}>{children}</NativeChatHandOffContext.Provider>
  )
}

/** Says where a handed-off chat continues and jumps there. */
export function NativeChatContinuedOnBanner({
  continuedTo
}: {
  continuedTo: AgentSessionContinuedTo
}): React.JSX.Element {
  const t = useTranslate()
  const place = useHandoffContinuationPlace(continuedTo)
  const host = place?.label ?? ''
  const hostId = place?.hostId ?? null
  return (
    <PaneTopBanner
      tone="accent"
      icon={ArrowUpRight}
      title={t('components.agentSessionContinuation.continuedOn', 'Continued on {{host}}', {
        host
      })}
      body={t(
        'components.agentSessionContinuation.continuedOnBody',
        'This chat is read-only. The conversation goes on there.'
      )}
      primaryAction={
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!hostId}
          title={place ? (handoffContinuationUnreachable(place) ?? undefined) : undefined}
          onClick={() => hostId && openHandoffContinuation(continuedTo, hostId)}
        >
          {t('components.agentSessionContinuation.openContinuation', 'Open on {{host}}', {
            host
          })}
        </Button>
      }
      // Sits where the composer was; px-3 lines it up with the chat's column. Not `font-sans`: chat maps it to its font.
      className="shrink-0 rounded-md border px-3 font-(family-name:--font-sans)"
    />
  )
}
