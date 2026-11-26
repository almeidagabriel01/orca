// Where a chat's conversation went when it was handed off to another host; the source stays as a
// read-only record that no longer runs, so one conversation never has two live chats.
import { agentSessionOwnerObservationVerdict } from '../leases/agent-session-lease-adjudication'
import type { AgentSessionOwnerObservation } from '../leases/agent-session-conversation-view'

export type AgentSessionContinuedTo = {
  /** The destination Orca's own installation id (its host descriptor's), the same for every client
   *  that reads this record; each maps it back to its own host. Absent when it could not be read. */
  installationId?: string
  /** The destination's name when the hand-off happened, for a client that does not know that host. */
  hostLabel?: string
  /** The destination chat; absent when it opened as a terminal. */
  sessionId?: string
  /** The destination workspace on that host. */
  worktreeId?: string
  at: number
}

/** Mixed into the record, so its field needs no extra line there. */
export type AgentSessionContinuation = {
  /** Handed off to another host: the conversation goes on there, and this chat no longer runs. */
  continuedTo?: AgentSessionContinuedTo
}

const MAX_ID_LENGTH = 512

function optionalBounded(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH)
  )
}

/** The mark from a stored row or a paired host's frame, or undefined when it is malformed. A mark
 *  saved before installation ids (only a client-relative `executionHostId`) reads as an unknown host. */
export function readAgentSessionContinuedTo(value: unknown): AgentSessionContinuedTo | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('at' in value) ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at)
  ) {
    return undefined
  }
  const installationId = 'installationId' in value ? value.installationId : undefined
  const hostLabel = 'hostLabel' in value ? value.hostLabel : undefined
  const sessionId = 'sessionId' in value ? value.sessionId : undefined
  const worktreeId = 'worktreeId' in value ? value.worktreeId : undefined
  if (
    !optionalBounded(installationId) ||
    !optionalBounded(hostLabel) ||
    !optionalBounded(sessionId) ||
    !optionalBounded(worktreeId)
  ) {
    return undefined
  }
  return {
    ...(installationId !== undefined ? { installationId } : {}),
    ...(hostLabel !== undefined ? { hostLabel } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(worktreeId !== undefined ? { worktreeId } : {}),
    at: value.at
  }
}

export function agentSessionContinuedToEqual(
  a: AgentSessionContinuedTo | undefined,
  b: AgentSessionContinuedTo | undefined
): boolean {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.installationId === b.installationId &&
      a.hostLabel === b.hostLabel &&
      a.sessionId === b.sessionId &&
      a.worktreeId === b.worktreeId &&
      a.at === b.at)
  )
}

/** A handed-off chat proven stopped no longer holds its conversation; until then it still does. */
export function agentSessionHandedOff(record: {
  continuedTo?: AgentSessionContinuedTo
  ownerObservation: AgentSessionOwnerObservation
}): boolean {
  return (
    record.continuedTo !== undefined &&
    agentSessionOwnerObservationVerdict(record.ownerObservation) === 'exited'
  )
}
