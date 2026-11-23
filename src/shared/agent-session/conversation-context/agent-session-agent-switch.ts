import * as z from 'zod'
import { isRecord } from '../../agent-status/child-work/agent-status-child-work-value-guards'
import {
  isAgentChatAccountChoice,
  isAgentChatAccountPick
} from '../../agent-launch/accounts/agent-chat-account-choice'
import {
  isAgentSessionAccountHome,
  type AgentSessionAccountHome
} from '../lifecycle/accounts/agent-session-account-home'
import type { AgentSessionProviderContextBoundary } from './agent-session-provider-context'

/** A host advertising this runs `agentSession.switchAgent`: a chat continues on another agent or
 *  account in place, same session and journal. */
export const AGENT_SESSION_AGENT_SWITCH_RUNTIME_CAPABILITY = 'agentSession.agent-switch.v1' as const

/** The marker row a switch writes; older clients print its text. */
export const AGENT_SESSION_AGENT_SWITCH_PRESENTATION = 'agent-switch'

/** Where a chat continues. `accountChoice` only for agents with a chat account of their own
 *  (`agentSupportsChatAccountChoice`): a saved account id, `system`, or `host` to follow the
 *  host's selection. Absent: an unchanged agent keeps its choice; another agent follows its host. */
export type AgentSessionAgentSwitchTarget = { agent: string; accountChoice?: string }

/** `account`: same agent on another account, resumed. `agent`: another agent, handed the context. */
export type AgentSessionAgentSwitchKind = 'account' | 'agent'

export type AgentSessionAgentSwitchResult = {
  kind: AgentSessionAgentSwitchKind
  /** The chat was cut by a usage limit: the switch sent its one continue on the new target. */
  continued: boolean
}

/** On the marker row: what changed, and what the new agent was handed. */
export type AgentSessionAgentSwitchMark = {
  kind: AgentSessionAgentSwitchKind
  fromAgent: string
  toAgent: string
  fromAccountLabel?: string
  /** The account the chat continues on, as people read it; for an agent without chat accounts,
   *  the host's selection. */
  toAccountLabel?: string
  /** Agent switches only: a bounded excerpt of the context the new agent got, and the saved
   *  transcript it was pointed at. */
  handoff?: { excerpt: string; transcriptPath?: string }
}

/** One stretch of a chat on one agent and account; usage and history attribute by stretch. */
export type AgentSessionProviderSegment = {
  provider: string
  /** Absent: the host's selection at the time. */
  accountChoice?: string
  startedAt: number
  /** The switch that started it; absent on the chat's first stretch. */
  switchOperationId?: string
}

/** Context a switch to another agent left for that agent's first turn. */
export type AgentSessionPendingHandoff = {
  /** The switch that wrote it; the context is given once per switch. */
  operationId: string
  /** Private host file holding the continuation prompt. */
  promptPath: string
}

/** The conversations a chat held on an agent it switched away from, as Session History rows
 *  name them, so their rows still belong to the chat. */
export type AgentSessionRetiredConversations = {
  provider: string
  /** The home those conversations were written under; the switch replaced the record's own. */
  accountHome: AgentSessionAccountHome
  providerSessionIds: string[]
}

export const MAX_AGENT_SESSION_PROVIDER_SEGMENTS = 64
export const MAX_AGENT_SESSION_RETIRED_CONVERSATIONS = 64
export const MAX_AGENT_SESSION_RETIRED_CONVERSATION_IDS = 256
export const MAX_AGENT_SESSION_AGENT_SWITCH_EXCERPT_CHARS = 4_000
const MAX_LABEL = 256
const MAX_PATH = 4_096
const AGENT = /^[a-z0-9][a-z0-9_-]{0,63}$/

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max

export function isAgentSessionAgentSwitchTarget(
  value: unknown
): value is AgentSessionAgentSwitchTarget {
  if (!isRecord(value)) {
    return false
  }
  const target = value
  return (
    typeof target.agent === 'string' &&
    AGENT.test(target.agent) &&
    (target.accountChoice === undefined || isAgentChatAccountPick(target.accountChoice))
  )
}

export function isAgentSessionAgentSwitchMark(
  value: unknown
): value is AgentSessionAgentSwitchMark {
  if (!isRecord(value)) {
    return false
  }
  const mark = value
  const handoff = mark.handoff
  return (
    (mark.kind === 'account' || mark.kind === 'agent') &&
    isText(mark.fromAgent, 64) &&
    isText(mark.toAgent, 64) &&
    (mark.fromAccountLabel === undefined || isText(mark.fromAccountLabel, MAX_LABEL)) &&
    (mark.toAccountLabel === undefined || isText(mark.toAccountLabel, MAX_LABEL)) &&
    (handoff === undefined ||
      (isRecord(handoff) &&
        typeof handoff.excerpt === 'string' &&
        handoff.excerpt.length <= MAX_AGENT_SESSION_AGENT_SWITCH_EXCERPT_CHARS &&
        (handoff.transcriptPath === undefined || isText(handoff.transcriptPath, MAX_PATH))))
  )
}

export function isAgentSessionProviderSegment(
  value: unknown
): value is AgentSessionProviderSegment {
  if (!isRecord(value)) {
    return false
  }
  const segment = value
  return (
    isText(segment.provider, 64) &&
    (segment.accountChoice === undefined || isText(segment.accountChoice, 512)) &&
    typeof segment.startedAt === 'number' &&
    Number.isSafeInteger(segment.startedAt) &&
    segment.startedAt >= 0 &&
    (segment.switchOperationId === undefined || isText(segment.switchOperationId, 512))
  )
}

export function isAgentSessionRetiredConversations(
  value: unknown
): value is AgentSessionRetiredConversations {
  if (!isRecord(value)) {
    return false
  }
  const retired = value
  const ids = retired.providerSessionIds
  return (
    isText(retired.provider, 64) &&
    isAgentSessionAccountHome(retired.accountHome) &&
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_AGENT_SESSION_RETIRED_CONVERSATION_IDS &&
    ids.every((id) => isText(id, MAX_PATH))
  )
}

/** Keeps the newest stretches; the first one is dropped before any later one. */
export function withAgentSessionProviderSegment(
  segments: readonly AgentSessionProviderSegment[] | undefined,
  next: AgentSessionProviderSegment
): AgentSessionProviderSegment[] {
  return [...(segments ?? []), next].slice(-MAX_AGENT_SESSION_PROVIDER_SEGMENTS)
}

export function isAgentSessionPendingHandoff(value: unknown): value is AgentSessionPendingHandoff {
  if (!isRecord(value)) {
    return false
  }
  const pending = value
  return isText(pending.operationId, 512) && isText(pending.promptPath, MAX_PATH)
}

/** The account the chat runs on, and the stretches its switches made, on the chat's record. */
export type AgentSessionSwitchFields = {
  /** The account the user chose for this chat (`isAgentChatAccountChoice`); absent: its launches
   *  follow the host's selection. */
  accountChoice?: string
  /** Each stretch the chat ran on one agent and account, oldest first; absent before any switch. */
  providerSegments?: AgentSessionProviderSegment[]
  /** A switch to another agent left this context for the new agent's first turn to carry; cleared
   *  once that agent took it. `promptPath` is a private file on the host. */
  pendingHandoff?: AgentSessionPendingHandoff
  /** Each agent the chat switched away from and the conversations it held there, oldest first. */
  retiredConversations?: AgentSessionRetiredConversations[]
}

export function isAgentSessionSwitchFields(record: {
  accountChoice?: unknown
  providerSegments?: unknown
  pendingHandoff?: unknown
  retiredConversations?: unknown
}): boolean {
  const { accountChoice, providerSegments: segments, pendingHandoff, retiredConversations } = record
  return (
    (accountChoice === undefined || isAgentChatAccountChoice(accountChoice)) &&
    (segments === undefined ||
      (Array.isArray(segments) &&
        segments.length <= MAX_AGENT_SESSION_PROVIDER_SEGMENTS &&
        segments.every(isAgentSessionProviderSegment))) &&
    (pendingHandoff === undefined || isAgentSessionPendingHandoff(pendingHandoff)) &&
    (retiredConversations === undefined ||
      (Array.isArray(retiredConversations) &&
        retiredConversations.length <= MAX_AGENT_SESSION_RETIRED_CONVERSATIONS &&
        retiredConversations.every(isAgentSessionRetiredConversations)))
  )
}

/** What a context divider carries: a clear's boundary, and a switch's agent and account. */
export type AgentSessionContextDividerFields = {
  contextClear?: AgentSessionProviderContextBoundary
  agentSwitch?: AgentSessionAgentSwitchMark
}

// Plain zod, not z.custom: saved journal storage closes every schema it stores.
export const AgentSessionAgentSwitchMarkSchema = z.object({
  kind: z.enum(['account', 'agent']),
  fromAgent: z.string().min(1).max(64),
  toAgent: z.string().min(1).max(64),
  fromAccountLabel: z.string().min(1).max(MAX_LABEL).optional(),
  toAccountLabel: z.string().min(1).max(MAX_LABEL).optional(),
  handoff: z
    .object({
      excerpt: z.string().max(MAX_AGENT_SESSION_AGENT_SWITCH_EXCERPT_CHARS),
      transcriptPath: z.string().min(1).max(MAX_PATH).optional()
    })
    .optional()
})
