import { useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { HandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { retargetContinuationRequest } from '@/lib/agent-session/launch/continuation/handoff-continuation-retarget'
import { commitAndPushHandoffSource } from '@/lib/agent-session/launch/continuation/handoff-source-publish'
import { syncHandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destination-sync'
import type { AgentSessionContinuationRequest } from '../../../../shared/agent-session/conversation-context/agent-session-continuation'
import { useHandoffDestinations } from './use-handoff-destinations'
import { useHandoffSourceGitState } from './use-handoff-source-git-state'

type Picked = { request: AgentSessionContinuationRequest | null; key: string }
type Publish = {
  request: AgentSessionContinuationRequest | null
  running: boolean
  error: string | null
}

/** The dialog's Environment choice: where the new session opens, and what must be pushed first. */
export function useHandoffEnvironment(
  open: boolean,
  request: AgentSessionContinuationRequest | null
) {
  const destinations = useHandoffDestinations(open ? request?.worktreeId : undefined)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [message, setMessage] = useState<{
    request: AgentSessionContinuationRequest | null
    text: string
  } | null>(null)
  const [publish, setPublish] = useState<Publish | null>(null)
  const [syncError, setSyncError] = useState<Picked | null>(null)

  const current = destinations?.[0]
  const chosen =
    picked?.request === request
      ? destinations?.find((row) => row.key === picked.key && !row.block)
      : undefined
  const destination: HandoffDestination | undefined = chosen ?? current
  const elsewhere = Boolean(destination && current && destination.key !== current.key)

  const git = useHandoffSourceGitState({
    worktreeId: request?.worktreeId ?? '',
    executionHostId: current?.hostId,
    enabled: open && elsewhere && Boolean(request)
  })

  // The request the agent picker detects against and the launch uses: the destination's workspace.
  const effectiveRequest = useMemo(
    () =>
      request && elsewhere && destination?.worktreeId && destination.worktreePath
        ? retargetContinuationRequest(request, {
            worktreeId: destination.worktreeId,
            worktreePath: destination.worktreePath,
            sameHost: false
          })
        : request,
    [request, elsewhere, destination?.worktreeId, destination?.worktreePath]
  )

  const defaultMessage = destination
    ? translate(
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
    elsewhere,
    effectiveRequest,
    // Another host sees only what is pushed, so the source must be clean before starting there.
    startBlocked: elsewhere && git.state.kind !== 'clean',
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
