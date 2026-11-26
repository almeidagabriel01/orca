import { useCallback } from 'react'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { selectAgentLaunchRouteView } from '@/lib/agent-session/launch/routing/agent-launch-route-input'
import { useChatProgramFactsVersion } from '@/lib/agent-session/launch/inventory/host-chat-program-acquisition'
import { recomputeOn } from '@/lib/recompute-on'
import {
  resolveAiVaultHistorySessionResumeState,
  resolveAiVaultSessionResumeActions,
  type AiVaultSessionResumeTargetState
} from './ai-vault-session-resume'
import type { AiVaultResumeInChatEligibility } from './ai-vault-session-resume-in-chat'
import {
  resolveAiVaultHistoryRowResume,
  resolveAiVaultSessionResumeInChatForWorkspace
} from './ai-vault-session-resume-in-chat-workspace'
import {
  aiVaultResumeSessionForWorkspace,
  resolveAiVaultOtherMachineOrigin
} from './ai-vault-session-other-machine'
import {
  useAiVaultSessionOwnerWorkspaces,
  useAiVaultSessionWorktreeMap
} from '../session-list/ai-vault-session-worktree'
import { withAiVaultCurrentWorktreeStatus } from '../../../../../../shared/ai-vault/session-display/ai-vault-session-worktree'

import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import {
  isDisconnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/hosts/connections/runtime-host-connection-state'
import type { RuntimeStatuses } from '@/store/slices/runtime-status/views/runtime-status-owner'

const selectHostStatuses = (_state: unknown, statuses: RuntimeStatuses): RuntimeStatuses => statuses

export function useAiVaultPanelSessionResume(args: {
  sessions: readonly AiVaultSession[]
  repos: readonly Repo[]
  allWorktrees: readonly Worktree[]
  workspaceId: string | null
  resumeTargetState: AiVaultSessionResumeTargetState
  /** Host names as the host menu shows them. */
  hostLabel?: (hostId: ExecutionHostId) => string
}) {
  const { sessions, repos, allWorktrees, workspaceId, resumeTargetState, hostLabel } = args
  // Folder workspaces also own sessions by cwd for resume and jump.
  const ownerWorkspaces = useAiVaultSessionOwnerWorkspaces(allWorktrees, resumeTargetState)
  const sessionWorktreeById = useAiVaultSessionWorktreeMap({
    sessions,
    repos,
    worktrees: ownerWorkspaces
  })
  // Stamp current per row to preserve the cached ownership map.
  const getSessionWorktreeInfo = useCallback(
    (session: AiVaultSession) =>
      withAiVaultCurrentWorktreeStatus(
        // A copy's aliases name this holder's folder; it belongs to its recording host's workspace.
        session.recordedOnOtherMachine
          ? (resolveAiVaultOtherMachineOrigin({ session, worktrees: ownerWorkspaces, repos })
              ?.worktreeInfo ?? null)
          : (sessionWorktreeById.get(session.id) ?? null),
        workspaceId
      ),
    [workspaceId, sessionWorktreeById, ownerWorkspaces, repos]
  )
  const getSessionRowResumeArgs = useCallback(
    (session: AiVaultSession) => ({
      session,
      worktreeInfo: getSessionWorktreeInfo(session),
      activeWorktreeId: workspaceId,
      worktrees: ownerWorkspaces,
      repos,
      targetState: resumeTargetState
    }),
    [workspaceId, getSessionWorktreeInfo, ownerWorkspaces, repos, resumeTargetState]
  )
  // A synced copy resumes on the host that recorded it, so its row follows that host's connection.
  const hostStatuses = useAppStoreWithHostStatuses(selectHostStatuses)
  const isHostOffline = useCallback(
    (hostId: string) => {
      const host = parseExecutionHostId(hostId)
      return (
        host?.kind === 'runtime' &&
        isDisconnectedRuntimeHostState(
          runtimeHostConnectionStateForEntry(hostStatuses.get(host.environmentId))
        )
      )
    },
    [hostStatuses]
  )
  const getSessionResumeState = useCallback(
    (session: AiVaultSession) =>
      resolveAiVaultHistorySessionResumeState({
        ...getSessionRowResumeArgs(session),
        isHostOffline,
        hostLabel
      }),
    [getSessionRowResumeArgs, isHostOffline, hostLabel]
  )
  const getSessionResumeActions = useCallback(
    (session: AiVaultSession) => {
      if (!session.recordedOnOtherMachine) {
        return resolveAiVaultSessionResumeActions({
          ...getSessionRowResumeArgs(session),
          sessionFilePath: session.filePath,
          sessionExecutionHostId: session.executionHostId
        })
      }
      // Only the recording host's workspace; a new tab in the active one could sit on the copy's host.
      const state = getSessionResumeState(session)
      return {
        worktree: { worktreeId: state.worktreeId, disabled: state.blocked },
        newTab: { worktreeId: null, disabled: true }
      }
    },
    [getSessionRowResumeArgs, getSessionResumeState]
  )
  // Chat resume must preserve the session’s workspace: Claude finds transcripts through launch-cwd-derived paths.
  const launchRoute = useAppStoreWithHostStatuses(selectAgentLaunchRouteView)
  const chatProgramFactsVersion = useChatProgramFactsVersion()
  const getSessionResumeInChat = useCallback(
    (session: AiVaultSession): AiVaultResumeInChatEligibility => {
      // Eligibility reads the store and host agent caches outside its arguments; these track them.
      if (!session.recordedOnOtherMachine) {
        return recomputeOn([launchRoute, chatProgramFactsVersion], () =>
          resolveAiVaultHistoryRowResume({
            ...getSessionRowResumeArgs(session),
            settings: launchRoute.settings
          })
        ).resumeInChat
      }
      // A copy is judged as its recording host's own session, in that host's workspace.
      const resumeState = getSessionResumeState(session)
      const onRecordingHost = resumeState.blocked
        ? null
        : aiVaultResumeSessionForWorkspace(session, resumeTargetState, resumeState.worktreeId)
      if (!onRecordingHost) {
        return { available: false, reason: 'remote' }
      }
      return recomputeOn([launchRoute, chatProgramFactsVersion], () =>
        resolveAiVaultSessionResumeInChatForWorkspace({
          session: onRecordingHost,
          resumeState,
          activeWorkspaceId: workspaceId,
          targetState: resumeTargetState,
          settings: launchRoute.settings
        })
      )
    },
    [
      getSessionRowResumeArgs,
      getSessionResumeState,
      launchRoute,
      chatProgramFactsVersion,
      resumeTargetState,
      workspaceId
    ]
  )
  return {
    getSessionWorktreeInfo,
    getSessionResumeState,
    getSessionResumeActions,
    getSessionResumeInChat
  }
}
