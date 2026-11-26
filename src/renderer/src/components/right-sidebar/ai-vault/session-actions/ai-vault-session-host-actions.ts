import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { handoffBlockText } from '@/components/agent-session-continuation/HandoffEnvironmentField'
import {
  isPickableHandoffDestination,
  type HandoffDestination
} from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { getTranslatedExecutionHostLabel } from '@/runtime/hosts/display/execution-host-label'
import {
  aiVaultAgentLabel,
  isAiVaultSessionResumableContent,
  type AiVaultSession
} from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { canContinueAiVaultSessionInNewSession } from '../../../../../../shared/ai-vault/resume/ai-vault-session-continuation'
import {
  aiVaultCopyHandoffSourceWorktreeId,
  aiVaultOtherMachineOfflineReason
} from './ai-vault-session-other-machine'
import type {
  AiVaultSessionResumeActions,
  AiVaultSessionResumeState
} from './ai-vault-session-resume'

/** The host that recorded the conversation and its workspace there; a synced copy's is never the copy's host. */
export type AiVaultSessionHostOrigin = {
  hostId: ExecutionHostId
  hostLabel: string
  /** The origin host's workspace holding the recorded cwd; hand-offs start from it. */
  worktreeId: string | null
  /** That workspace can take a resume of this session. */
  resumable: boolean
  offline: boolean
  /** Why the origin cannot take a resume, when the resolver already knows. */
  unavailableReason?: string
}

export function resolveAiVaultSessionHostOrigin(
  session: AiVaultSession,
  state: AiVaultSessionResumeState,
  actions: AiVaultSessionResumeActions
): AiVaultSessionHostOrigin {
  const hostId = session.recordedOnOtherMachine
    ? (state.originHostId ?? session.executionHostId)
    : session.executionHostId
  return {
    hostId,
    hostLabel: state.originHostLabel ?? state.hostLabel ?? getTranslatedExecutionHostLabel(hostId),
    worktreeId: actions.worktree.worktreeId ?? state.originWorktreeId ?? null,
    resumable: Boolean(actions.worktree.worktreeId) && !actions.worktree.disabled,
    // A copy's resolver names its origin's workspace only while that host is offline.
    offline: Boolean(state.hostOffline || state.originWorktreeId),
    ...(state.unavailableReason ? { unavailableReason: state.unavailableReason } : {})
  }
}

export type AiVaultSessionHostAction = {
  key: string
  /** Resume on the recording host; continue moves the conversation to another host. */
  kind: 'resume' | 'continue'
  hostLabel: string
  /** Null when the button runs. */
  disabledReason: string | null
}

/** One button per host the project is set up on: the origin first, then the hosts `destinations` lists. */
export function resolveAiVaultSessionHostActions(args: {
  session: AiVaultSession
  origin: AiVaultSessionHostOrigin
  /** `useHandoffDestinations` from the origin workspace; null without one. */
  destinations: readonly HandoffDestination[] | null
  /** An open chat or pane holds the conversation, so resume focuses it wherever it is. */
  openElsewhere: boolean
  t?: Translate
}): AiVaultSessionHostAction[] {
  const { session, origin, destinations, openElsewhere, t = translate } = args
  // The origin holds the transcript and the source workspace the hand-off starts from.
  const offlineReason = origin.offline ? aiVaultOtherMachineOfflineReason(origin.hostLabel) : null
  const resumeReason = openElsewhere
    ? null
    : offlineReason
      ? offlineReason
      : !isAiVaultSessionResumableContent(session)
        ? t(
            'components.native-chat.resumeInNewChat.notSavedYet',
            "{{agent}} hasn't saved this conversation yet. Try again after it replies.",
            { agent: aiVaultAgentLabel(session.agent) }
          )
        : (origin.unavailableReason ??
          (origin.resumable
            ? null
            : t(
                'auto.components.right.sidebar.AiVaultPanel.openWorkspaceBeforeResuming',
                'Open a workspace before resuming a session.'
              )))
  // A copy's recording host saves nothing for it, so the copy hands off its own preview.
  const canHandOff = session.recordedOnOtherMachine
    ? Boolean(aiVaultCopyHandoffSourceWorktreeId(session, origin.worktreeId))
    : canContinueAiVaultSessionInNewSession(session, origin.worktreeId)
  const others = (destinations ?? []).filter((row) => row.kind !== 'current')
  return [
    {
      key: `origin:${origin.hostId}`,
      kind: 'resume',
      hostLabel: origin.hostLabel,
      disabledReason: resumeReason
    },
    ...others.map((row) => ({
      key: row.key,
      kind: 'continue' as const,
      hostLabel: row.hostLabel,
      disabledReason:
        row.block && !isPickableHandoffDestination(row)
          ? handoffBlockText(t, row.block)
          : offlineReason
            ? offlineReason
            : canHandOff
              ? null
              : t(
                  'components.agentSessionContinuation.noContext',
                  'No session context is available to continue in a new session.'
                )
    }))
  ]
}
