// A chat handed off to another host: the mark lives on the source host's record, so every device
// reads it there; this module writes it, maps its destination onto this client's hosts, and opens it.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { readOwnInstallation } from '@/components/bots/use-paired-server-client-mentions'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { structuredAgentSessionTargetForHost } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { normalizeAgentSessionConversationName } from '../../../../../../shared/agent-session/conversation-naming/agent-session-conversation-name'
import { getTranslatedExecutionHostLabel } from '@/runtime/hosts/display/execution-host-label'
import { useAppStore } from '@/store'
import {
  readRuntimeStatuses,
  type RuntimeStatuses
} from '@/store/slices/runtime-status/views/runtime-status-owner'
import { useRuntimeStatusByEnvironmentId } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import {
  LOCAL_EXECUTION_HOST_ID,
  parseExecutionHostId,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import { lastVerifiedRuntimeStatus } from '../../../../../../shared/remote-runtime/host-status/runtime-host-status'
import type { AgentSessionContinuedTo } from '../../../../../../shared/agent-session/lifecycle/records/agent-session-continued-to'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

/** Where a launched continuation went, as the handing-off client names it. */
export type HandoffContinuation = {
  hostId: ExecutionHostId
  hostLabel: string
  sessionId?: string
  worktreeId?: string
}

/** A recorded destination on this client: its host here, or null when this client does not know it. */
export type HandoffContinuationPlace = { hostId: ExecutionHostId | null; label: string }

function pairedInstallationId(environmentId: string, statuses: RuntimeStatuses): string | null {
  return (
    lastVerifiedRuntimeStatus(statuses.get(environmentId))?.hostDescriptor?.installationId ?? null
  )
}

async function readHostInstallationId(hostId: ExecutionHostId): Promise<string | null> {
  const host = parseExecutionHostId(hostId)
  if (host?.kind === 'local') {
    return readOwnInstallation()
  }
  return host?.kind === 'runtime'
    ? pairedInstallationId(host.environmentId, readRuntimeStatuses())
    : null
}

/** Saves the hand-off on the source chat's host, which then stops that chat. */
export async function markHandoffContinuedTo(
  source: RuntimeClientTarget,
  sourceSessionId: string,
  destination: HandoffContinuation
): Promise<void> {
  try {
    // The installation id names the destination the same way for every client; the id here would not.
    const installationId = await readHostInstallationId(destination.hostId)
    await callStructuredAgentSession(source, 'agentSession.markContinuedTo', {
      sessionId: sourceSessionId,
      ...(installationId ? { installationId } : {}),
      hostLabel: destination.hostLabel,
      ...(destination.sessionId ? { continuedSessionId: destination.sessionId } : {}),
      ...(destination.worktreeId ? { worktreeId: destination.worktreeId } : {})
    })
  } catch (error) {
    // An older source host lacks the method: the continuation still runs, the source stays live.
    console.error('Could not mark the handed-off chat as continued', error)
    toast.warning(
      translate(
        'components.agentSessionContinuation.markFailed',
        'The new session started, but this chat could not be marked as continued there.'
      )
    )
  }
}

/** The continued chat keeps the source's name, not one drawn from the hand-off's technical prompt. */
export function nameHandoffContinuation(
  hostId: ExecutionHostId,
  sessionId: string,
  sourceTitle: string | null | undefined
): void {
  const name = normalizeAgentSessionConversationName(sourceTitle)
  const target = structuredAgentSessionTargetForHost(hostId)
  if (!name || !target) {
    return
  }
  callRuntimeRpc(target, 'agentSession.rename', { sessionId, name }).catch((error: unknown) => {
    // An older host keeps its own name for the chat; the continuation itself is unaffected.
    console.warn('Could not name the continued chat after its source', error)
  })
}

/** The one mapping of a recorded destination onto this client: its own installation is `local`, a
 *  paired server's is `runtime:<id>`, anything else (or a mark without an id) is known by label only. */
export function placeHandoffContinuation(
  continuedTo: AgentSessionContinuedTo,
  ownInstallationId: string | null,
  statuses: RuntimeStatuses,
  environmentNames: ReadonlyMap<string, string> = new Map()
): HandoffContinuationPlace {
  const id = continuedTo.installationId
  const fallbackLabel =
    continuedTo.hostLabel ??
    translate('components.agentSessionContinuation.otherComputer', 'another computer')
  if (id && id === ownInstallationId) {
    return {
      hostId: LOCAL_EXECUTION_HOST_ID,
      label: getTranslatedExecutionHostLabel(LOCAL_EXECUTION_HOST_ID)
    }
  }
  if (id) {
    for (const environmentId of statuses.keys()) {
      if (pairedInstallationId(environmentId, statuses) === id) {
        // The paired server's name here; the raw environment id means nothing to the user.
        const label = environmentNames.get(environmentId) || fallbackLabel
        return { hostId: toRuntimeExecutionHostId(environmentId), label }
      }
    }
  }
  return { hostId: null, label: fallbackLabel }
}

export function useHandoffContinuationPlace(
  continuedTo: AgentSessionContinuedTo | null
): HandoffContinuationPlace | null {
  const statuses = useRuntimeStatusByEnvironmentId()
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const [ownInstallationId, setOwnInstallationId] = useState<string | null>(null)
  const marked = continuedTo !== null
  useEffect(() => {
    if (!marked) {
      return
    }
    let live = true
    void readOwnInstallation().then((id) => {
      if (live) {
        setOwnInstallationId(id)
      }
    })
    return () => {
      live = false
    }
  }, [marked])
  if (!continuedTo) {
    return null
  }
  const names = new Map(environments.map((environment) => [environment.id, environment.name]))
  return placeHandoffContinuation(continuedTo, ownInstallationId, statuses, names)
}

/** Why "Open on <host>" is off: this client is not connected to the destination. */
export function handoffContinuationUnreachable(place: HandoffContinuationPlace): string | null {
  return place.hostId
    ? null
    : translate(
        'components.agentSessionContinuation.hostUnknown',
        'This computer is not connected to {{host}}, so the chat cannot open here.',
        { host: place.label }
      )
}

/** Opens the continuation on its host here: its chat, else that host's workspace. */
export function openHandoffContinuation(
  continuedTo: AgentSessionContinuedTo,
  hostId: ExecutionHostId
): void {
  const host = parseExecutionHostId(hostId)
  if (continuedTo.sessionId && continuedTo.worktreeId && host && host.kind !== 'ssh') {
    void activateAiVaultStructuredSession(
      {
        structuredSession: { sessionId: continuedTo.sessionId, workspaceId: continuedTo.worktreeId }
      },
      undefined,
      host.kind === 'local'
        ? { kind: 'local' }
        : { kind: 'environment', environmentId: host.environmentId }
    )
    return
  }
  if (continuedTo.worktreeId) {
    activateAndRevealWorkspace(continuedTo.worktreeId, { executionHostId: hostId })
  }
}
