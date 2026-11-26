import { translate } from '@/i18n/i18n'
import {
  isPickableHandoffDestination,
  type HandoffDestination
} from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { isCursorAcpSessionRow } from '../../../../../../shared/ai-vault/session-display/cursor-acp-session-path'
import { getAiVaultResumeWorkspaceExecutionHostId } from '@/lib/agent-session/resume/history/ai-vault-resume-target'
import type { AppState } from '@/store/types'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  normalizeExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import {
  canJumpToAiVaultSessionWorktree,
  resolveAiVaultSessionWorktreeInfo,
  type AiVaultSessionOwnerRepo,
  type AiVaultSessionOwnerWorkspace,
  type AiVaultSessionWorktreeInfo
} from '../../../../../../shared/ai-vault/session-display/ai-vault-session-worktree'

/** The host badge of a copy synced from another computer, listed only while that computer's own row is missing. */
export function aiVaultOtherMachineLabel(originHostLabel?: string): string {
  return originHostLabel
    ? translate('aiVault.recordedOnHost', 'Recorded on {{value0}}', { value0: originHostLabel })
    : translate(
        'aiVault.recordedOnOtherMachineCopy',
        'Recorded on another computer · open it there'
      )
}

/** The workspace, on a host other than the copy's, that holds the recorded cwd. */
export function resolveAiVaultOtherMachineOrigin(args: {
  session: AiVaultSession
  worktrees: readonly AiVaultSessionOwnerWorkspace[]
  repos: readonly AiVaultSessionOwnerRepo[]
}): { hostId: ExecutionHostId; worktreeInfo: AiVaultSessionWorktreeInfo } | null {
  const repoById = new Map(args.repos.map((repo) => [repo.id, repo]))
  const hosts = new Set(
    args.worktrees.map((worktree) => {
      const repo = repoById.get(worktree.repoId)
      return (
        normalizeExecutionHostId(worktree.hostId) ??
        (repo ? getRepoExecutionHostId(repo) : LOCAL_EXECUTION_HOST_ID)
      )
    })
  )
  // ponytail: first host holding the path wins; two other hosts with one path are not told apart.
  for (const hostId of hosts) {
    if (hostId === args.session.executionHostId) {
      continue
    }
    // Aliases name the holder's folders; only the recorded cwd names the origin's.
    const worktreeInfo = resolveAiVaultSessionWorktreeInfo({
      session: { ...args.session, executionHostId: hostId, cwdAliases: undefined },
      worktrees: args.worktrees,
      repos: args.repos,
      activeWorktreeId: null
    })
    if (worktreeInfo && canJumpToAiVaultSessionWorktree(worktreeInfo)) {
      return { hostId, worktreeInfo }
    }
  }
  return null
}

/** The copy as its recording host's own session: holder-only facts are dropped so nothing reads the copy. */
export function aiVaultSessionOnRecordingHost(
  session: AiVaultSession,
  hostId: ExecutionHostId
): AiVaultSession {
  const {
    cwdAliases: _aliases,
    recordedOnOtherMachine: _copy,
    executionHostPlatform: _platform,
    accountHome: _home,
    accountWslDistro: _distro,
    // A holder's chat that adopted the copy owns only the copy; the recording host resumes its own.
    structuredSession: _holderChat,
    ...rest
  } = session
  return { ...rest, executionHostId: hostId, resumeCommand: '', codexHome: null }
}

/** What a row resumes in a workspace: a synced copy only as its recording host's session, never on the copy's own host. */
export function aiVaultResumeSessionForWorkspace(
  session: AiVaultSession,
  state: Pick<AppState, 'folderWorkspaces' | 'projectGroups' | 'repos' | 'worktreesByRepo'>,
  worktreeId: string | null | undefined
): AiVaultSession | null {
  if (!session.recordedOnOtherMachine) {
    return session
  }
  const hostId = worktreeId ? getAiVaultResumeWorkspaceExecutionHostId(state, worktreeId) : null
  return hostId && hostId !== session.executionHostId
    ? aiVaultSessionOnRecordingHost(session, hostId)
    : null
}

/** A synced copy's hand-off source: its recording host's workspace, when the copy's preview holds a conversation. */
export function aiVaultCopyHandoffSourceWorktreeId(
  session: AiVaultSession,
  resumeWorktreeId: string | null | undefined
): string | null {
  return session.recordedOnOtherMachine &&
    resumeWorktreeId &&
    !isCursorAcpSessionRow(session) &&
    session.previewMessages.some((message) => message.text.trim())
    ? resumeWorktreeId
    : null
}

/** Where a synced copy can continue besides its recording host: the first host the hand-off dialog accepts. */
export function aiVaultCopyContinueDestination(
  destinations: readonly HandoffDestination[] | null
): HandoffDestination | null {
  // ponytail: first pickable host wins; with three or more hosts the dialog's picker reaches the rest.
  return (
    destinations?.find((row) => row.kind === 'same-branch' && isPickableHandoffDestination(row)) ??
    null
  )
}

export function aiVaultOtherMachineOfflineReason(hostLabel: string): string {
  return translate(
    'aiVault.recordedOnOfflineHost',
    'Recorded on {{value0}}, which is offline. Reconnect it to resume there.',
    { value0: hostLabel }
  )
}

export function aiVaultOtherMachineUnknownReason(): string {
  return translate(
    'aiVault.recordedOnUnknownHost',
    'Recorded on another computer. Open its folder as a workspace on that computer to resume it there.'
  )
}
