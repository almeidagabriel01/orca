import { createHash } from 'node:crypto'
import { agentSessionOperationKey } from '../../../../shared/agent-session/lifecycle/operations/agent-session-operation-ledger'
import { agentSessionRefusalError } from '../../../../shared/agent-session/failures/agent-session-wire-refusals'
import { agentChatPermissionModes } from '../../../../shared/agent-launch/permissions/agent-chat-permission-support'
import { cancelAgentSessionUsageLimitContinue } from '../../../../shared/agent-session/lifecycle/stopping/agent-session-usage-limit-continue'
import {
  MAX_AGENT_SESSION_RETIRED_CONVERSATIONS,
  withAgentSessionProviderSegment,
  type AgentSessionAgentSwitchKind,
  type AgentSessionPendingHandoff,
  type AgentSessionRetiredConversations
} from '../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { AgentSessionAccountHome } from '../../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import type { UsageLimitContinueIdentity } from '../../../../shared/agent-session/lifecycle/stopping/agent-session-usage-limit-continue'
import type { AgentSessionStoreState } from './agent-session-store-state'
import { withoutAgentSessionInstructionsKey } from './agent-session-instructions-receipt'

/** A chat moving to another account (same agent, resumed) or another agent (fresh context). */
export type AgentSessionAgentSwitch = {
  sessionId: string
  fence: number
  /** Hash of the switch's operation key; names the boundary, segment and handoff. */
  switchId: string
  kind: AgentSessionAgentSwitchKind
  provider: string
  /** Agent switches only: the new agent's home. An account switch keeps the record's own. */
  accountHome?: AgentSessionAccountHome
  /** Null: follow the host's selection. */
  accountChoice: string | null
  pendingHandoff?: AgentSessionPendingHandoff
  /** Agent switches only: the old chain's Session History row ids, read on main because the agent
   *  metadata must stay out of the journal worker. Absent: the links' native ids. */
  retiredProviderSessionIds?: string[]
  /** The usage-limit cut the chat stopped on; a person's switch withdraws its automatic continue. */
  withdrawCut?: UsageLimitContinueIdentity
  now: number
}

export function agentSessionAgentSwitchId(callerKey: string, operationId: string): string {
  return createHash('sha256').update(agentSessionOperationKey(callerKey, operationId)).digest('hex')
}

/** The record moves only while no owner runs, as a clear does; the journal publishes its marker. */
export function commitAgentSessionAgentSwitchRecord(
  state: AgentSessionStoreState,
  change: AgentSessionAgentSwitch
): void {
  const source = state.records.get(change.sessionId)
  if (!source || source.lease.runtimeFence !== change.fence) {
    throw agentSessionRefusalError('agent_session_checkpoint_stale', { reason: 'leaseMoved' })
  }
  if (source.lease.ownerProcess !== null || source.lease.claimStatus !== 'released') {
    throw agentSessionRefusalError('agent_session_ownership_unknown', { reason: 'leaseMoved' })
  }
  state.records.set(change.sessionId, switchedAgentSessionRecord(source, change))
}

export function switchedAgentSessionRecord(
  source: AgentSessionRecord,
  change: Omit<AgentSessionAgentSwitch, 'sessionId' | 'fence'>
): AgentSessionRecord {
  const withdrawn = change.withdrawCut
    ? cancelAgentSessionUsageLimitContinue(source, change.withdrawCut)
    : source
  // The first stretch is the chat as it was created, before any switch.
  const segments = withAgentSessionProviderSegment(
    withdrawn.providerSegments ?? [
      {
        provider: source.provider,
        ...(source.accountChoice ? { accountChoice: source.accountChoice } : {}),
        startedAt: source.createdAt
      }
    ],
    {
      provider: change.provider,
      ...(change.accountChoice ? { accountChoice: change.accountChoice } : {}),
      startedAt: change.now,
      switchOperationId: change.switchId
    }
  )
  const { accountChoice: _account, pendingHandoff: _pending, ...rest } = withdrawn
  const moved: AgentSessionRecord = {
    ...rest,
    ...(change.accountChoice ? { accountChoice: change.accountChoice } : {}),
    providerSegments: segments,
    updatedAt: change.now
  }
  if (change.kind === 'account') {
    return moved
  }
  // Another agent: its options, launch args, launches and conversation are the old agent's.
  const {
    options: _options,
    launchArgs: _launchArgs,
    launchedAccount: _launched,
    acquiredAccount: _acquired,
    permissionMode,
    ...fresh
  } = withoutAgentSessionInstructionsKey(moved)
  // Modes mean different powers per agent; only asking carries over, others take the new default.
  const keepsMode =
    (permissionMode === 'ask' || permissionMode === 'own') &&
    (permissionMode === 'own' ||
      agentChatPermissionModes(change.provider)?.modes.some((mode) => mode === permissionMode) ===
        true)
  return {
    ...fresh,
    provider: change.provider,
    ...(change.accountHome ? { accountHome: change.accountHome } : {}),
    ...(keepsMode ? { permissionMode } : {}),
    ...(change.pendingHandoff ? { pendingHandoff: change.pendingHandoff } : {}),
    ...retiredConversations(source, change.retiredProviderSessionIds),
    providerHandleChain: [],
    lease: { ...source.lease, provenHandleLinkId: null },
    providerContextBoundary: {
      operationId: change.switchId,
      afterFence: source.lease.runtimeFence,
      clearedAt: change.now
    }
  }
}

// The old agent's rows in Session History stay this chat's once its chain is gone.
function retiredConversations(
  source: AgentSessionRecord,
  rowIds: readonly string[] | undefined
): {
  retiredConversations?: AgentSessionRetiredConversations[]
} {
  const ids = new Set(rowIds ?? source.providerHandleChain.map((link) => link.handle.nativeId))
  const retired =
    ids.size === 0
      ? source.retiredConversations
      : [
          ...(source.retiredConversations ?? []),
          {
            provider: source.provider,
            accountHome: source.accountHome,
            providerSessionIds: [...ids]
          }
        ].slice(-MAX_AGENT_SESSION_RETIRED_CONVERSATIONS)
  return retired ? { retiredConversations: retired } : {}
}

/** The new agent took the turn that carried this switch's context. */
export function withAgentSessionHandoffGiven(
  record: AgentSessionRecord,
  switchId: string
): AgentSessionRecord {
  if (record.pendingHandoff?.operationId !== switchId) {
    return record
  }
  const { pendingHandoff: _given, ...rest } = record
  return rest
}
