import type React from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { useHandoffDestinations } from '@/components/agent-session-continuation/use-handoff-destinations'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  resolveAiVaultSessionHostActions,
  type AiVaultSessionHostAction,
  type AiVaultSessionHostOrigin
} from '../session-actions/ai-vault-session-host-actions'
import { useAppStore } from '@/store/index'
import { nativeChatPreferenceFor } from '../../../../../../shared/agent-launch/choices/structured-native-chat-launch-route'
import {
  adoptsCliConversations,
  CLI_CONVERSATION_ADOPTING_AGENTS
} from '../../../../../../shared/agent-session/view/structured-agent-cli-conversation-adoption'

export type AiVaultSessionHostActionsProps = {
  origin: AiVaultSessionHostOrigin
  /** An open chat or pane holds the conversation; Resume focuses it. */
  openElsewhere: boolean
  onResume: () => void
  /** Set when a new chat on the origin workspace can take the conversation. */
  onResumeInNewChat?: () => void
  onContinueOnHost: (environmentKey: string) => void
}

/** "Continue on <host>" for every host the project is set up on; the recording host first, marked by a dot. */
export function AiVaultSessionHostActions({
  session,
  origin,
  openElsewhere,
  onResume,
  onResumeInNewChat,
  onContinueOnHost
}: AiVaultSessionHostActionsProps & { session: AiVaultSession }): React.JSX.Element {
  const t = useTranslate()
  const destinations = useHandoffDestinations(origin.worktreeId ?? undefined, origin.hostId)
  const chatFirst = useAiVaultChatFirst(session)
  const resume =
    !openElsewhere && !session.structuredSession && chatFirst && onResumeInNewChat
      ? onResumeInNewChat
      : onResume
  // The project's host setups name hosts as the rest of the row does; a raw id means none matched.
  const current = destinations?.find((row) => row.kind === 'current')
  const actions = resolveAiVaultSessionHostActions({
    session,
    origin:
      current && current.hostLabel !== current.hostId
        ? { ...origin, hostLabel: current.hostLabel }
        : origin,
    destinations,
    openElsewhere,
    t
  })
  return (
    <>
      {actions.map((action) => (
        <HostActionButton
          key={action.key}
          action={action}
          label={t('components.agentSessionContinuation.continueOnHost', 'Continue on {{host}}', {
            host: action.hostLabel
          })}
          originMark={
            action.kind === 'resume'
              ? t('aiVault.recordedOnHost', 'Recorded on {{value0}}', { value0: action.hostLabel })
              : null
          }
          onClick={action.kind === 'resume' ? resume : () => onContinueOnHost(action.key)}
        />
      ))}
    </>
  )
}

/** Chat comes first where it is the default for a chat that can take the row over. */
export function useAiVaultChatFirst(session: Pick<AiVaultSession, 'agent'>): boolean {
  return useAppStore(
    (state) =>
      adoptsCliConversations(session.agent) &&
      CLI_CONVERSATION_ADOPTING_AGENTS[session.agent].some((agent) =>
        nativeChatPreferenceFor(state.settings, agent)
      )
  )
}

function HostActionButton({
  action,
  label,
  originMark,
  onClick
}: {
  action: AiVaultSessionHostAction
  label: string
  /** Set on the recording host's button: a dot marks it, the same verb as every other host. */
  originMark: string | null
  onClick: () => void
}): React.JSX.Element {
  const button = (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      disabled={action.disabledReason !== null}
      draggable={false}
      data-host-action={action.kind}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="min-w-0 max-w-full"
    >
      <ArrowRightLeft className="size-3.5" />
      <span className="truncate">{label}</span>
      {originMark ? (
        <span
          role="img"
          aria-label={originMark}
          title={originMark}
          className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
        />
      ) : null}
    </Button>
  )
  if (action.disabledReason === null) {
    return button
  }
  // A disabled button takes no pointer or focus, so the wrapper carries its reason.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex min-w-0 max-w-full" data-host-action-reason>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-xs">
        {action.disabledReason}
      </TooltipContent>
    </Tooltip>
  )
}
