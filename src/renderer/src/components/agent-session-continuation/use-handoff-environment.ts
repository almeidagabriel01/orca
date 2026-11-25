import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import {
  resolveHandoffDestination,
  type HandoffDestination
} from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { retargetContinuationRequest } from '@/lib/agent-session/launch/continuation/handoff-continuation-retarget'
import { commitAndPushHandoffSource } from '@/lib/agent-session/launch/continuation/handoff-source-publish'
import { syncHandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destination-sync'
import { createHandoffDestinationWorkspace } from '@/lib/agent-session/launch/continuation/handoff-destination-create'
import type { AgentSessionContinuationRequest } from '../../../../shared/agent-session/conversation-context/agent-session-continuation'
import { useHandoffDestinations } from './use-handoff-destinations'
import { useHandoffSourceGitState } from './use-handoff-source-git-state'

type Picked = { request: AgentSessionContinuationRequest | null; key: string }
type Publish = {
  request: AgentSessionContinuationRequest | null
  running: boolean
  error: string | null
}
export type HandoffDestinationCreation = { key: string; running: boolean; error: string | null }

/** The dialog's Environment choice: where the new session opens, and what must be pushed first. */
export type HandoffEnvironment = ReturnType<typeof useHandoffEnvironment>

export function useHandoffEnvironment(
  open: boolean,
  request: AgentSessionContinuationRequest | null,
  /** The destination key preselected until the user picks one. */
  initialKey?: string
) {
  const t = useTranslate()
  const destinations = useHandoffDestinations(open ? request?.worktreeId : undefined)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [message, setMessage] = useState<{
    request: AgentSessionContinuationRequest | null
    text: string
  } | null>(null)
  const [publish, setPublish] = useState<Publish | null>(null)
  const [syncError, setSyncError] = useState<Picked | null>(null)
  const [creation, setCreation] = useState<
    (HandoffDestinationCreation & { request: AgentSessionContinuationRequest | null }) | null
  >(null)

  const current = destinations?.[0]
  const destination = resolveHandoffDestination(
    destinations,
    picked?.request === request ? picked.key : initialKey
  )
  const elsewhere = Boolean(destination && current && destination.key !== current.key)

  const git = useHandoffSourceGitState({
    worktreeId: request?.worktreeId ?? '',
    executionHostId: current?.hostId,
    enabled: open && elsewhere && Boolean(request)
  })

  // The request the agent picker detects against and the launch uses: the destination's workspace.
  const destinationWorktreeId = destination?.worktreeId
  const destinationWorktreePath = destination?.worktreePath
  const effectiveRequest =
    request && elsewhere && destinationWorktreeId && destinationWorktreePath
      ? retargetContinuationRequest(request, {
          worktreeId: destinationWorktreeId,
          worktreePath: destinationWorktreePath,
          sameHost: false
        })
      : request

  const defaultMessage = destination
    ? t(
        'components.agentSessionContinuation.sourceChanges.defaultMessage',
        'chore: hand off work to {{host}}',
        { host: destination.hostLabel }
      )
    : ''
  const commitMessage = message?.request === request ? message.text : defaultMessage
  const publishing = publish?.request === request ? publish : null

  const commitAndPush = async (): Promise<void> => {
    if (!request || git.state.kind !== 'dirty' || publishing?.running) {
      return
    }
    setPublish({ request, running: true, error: null })
    const result = await commitAndPushHandoffSource({
      worktreeId: request.worktreeId,
      executionHostId: current?.hostId,
      message: commitMessage.trim() || defaultMessage,
      commit: git.state.uncommitted > 0
    })
    setPublish({
      request,
      running: false,
      error: result.ok ? null : result.reason
    })
    git.refresh()
  }

  const creating = creation?.request === request ? creation : null

  /** Creates the branch's workspace on that host (publishing first if needed), then picks it. */
  const createDestination = async (row: HandoffDestination): Promise<void> => {
    if (!request || row.block?.kind !== 'branch-missing' || !row.branch || creating?.running) {
      return
    }
    setCreation({ request, key: row.key, running: true, error: null })
    const result = await createHandoffDestinationWorkspace({
      sourceWorktreeId: request.worktreeId,
      sourceHostId: current?.hostId,
      hostId: row.hostId,
      repoId: row.block.repoId,
      branch: row.branch
    })
    setCreation({ request, key: row.key, running: false, error: result.ok ? null : result.reason })
    if (result.ok) {
      setPicked({ request, key: row.key })
    }
  }

  /** Runs right before launch: fast-forwards the destination; false means do not launch. */
  const prepareDestination = async (): Promise<boolean> => {
    setSyncError(null)
    if (!elsewhere) {
      return true
    }
    if (!destination?.worktreeId || !destination.branch) {
      return false
    }
    const synced = await syncHandoffDestination({
      worktreeId: destination.worktreeId,
      executionHostId: destination.hostId,
      expectedBranch: destination.branch
    })
    if (!synced.ok) {
      setSyncError({ request, key: synced.reason })
    }
    return synced.ok
  }

  return {
    destinations,
    destinationKey: destination?.key ?? '',
    pickDestination: (key: string) => setPicked({ request, key }),
    creation: creating,
    createDestination: (row: HandoffDestination) => void createDestination(row),
    elsewhere,
    effectiveRequest,
    // Another host sees only what is pushed, and needs the branch's workspace before starting there.
    startBlocked: elsewhere && (git.state.kind !== 'clean' || !destination?.worktreeId),
    destinationLabel: destination?.hostLabel ?? '',
    sourceChanges: {
      state: git.state,
      message: commitMessage,
      onMessageChange: (value: string) => setMessage({ request, text: value }),
      onCommitAndPush: () => void commitAndPush(),
      running: publishing?.running ?? false,
      error: publishing?.error ?? null,
      hostLabel: current?.hostLabel ?? ''
    },
    prepareDestination,
    destinationError: syncError?.request === request ? syncError.key : null
  }
}
