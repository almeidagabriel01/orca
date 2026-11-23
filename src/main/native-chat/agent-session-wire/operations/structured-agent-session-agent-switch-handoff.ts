// What a switch hands the next agent, and the marker row that shows it.

import {
  AGENT_SESSION_AGENT_SWITCH_PRESENTATION,
  MAX_AGENT_SESSION_AGENT_SWITCH_EXCERPT_CHARS,
  type AgentSessionAgentSwitchMark,
  type AgentSessionAgentSwitchTarget
} from '../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import { buildAgentSessionContinuationPrompt } from '../../../../shared/agent-session/conversation-context/agent-session-continuation'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { AgentJournalPlainStatusItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { getClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import { writeAgentSessionContextSnapshot } from '../../conversation-context/agent-session-context-snapshots'
import type { AgentSessionAgentSwitch } from '../../../runtime/agent-session/records/agent-session-agent-switch-record'
import { structuredAgentRuntimeMetadata } from '../../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import type { StructuredAgentSessionHost } from '../host/structured-agent-session-host'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-mutation-context'

/** What another agent is handed: the prompt it reads first, and what the marker shows of it. */
export type AgentSwitchHandoff = {
  promptPath: string
  excerpt: string
  transcriptPath?: string
}

function accountLabel(choice: string | null): string | undefined {
  return choice ? getClaudeProfileRouter()?.savedAccount(choice)?.email : undefined
}

/** Read outside the chat's lane: the capture opens the conversation and writes the transcript. */
export async function prepareAgentSwitchHandoff(
  context: StructuredAgentSessionMutationContext,
  host: Pick<StructuredAgentSessionHost, 'continuationContext'>,
  sessionId: string,
  target: AgentSessionAgentSwitchTarget
): Promise<AgentSwitchHandoff | null> {
  const record = context.deps.store.getConversation(sessionId)
  if (!record || record.provider === target.agent) {
    return null
  }
  const session = await context.conversation(sessionId)
  const read = await host.continuationContext({
    sessionId,
    workspaceId: record.location.workspaceId,
    expectedCursor: session.journal.cursor()
  })
  if (read.status !== 'current') {
    // Another agent must not start without the chat; the switch is refused instead.
    throw new Error(`agent_switch_context_${read.status}`)
  }
  const capturedText = read.capturedText ?? ''
  const prompt = buildAgentSessionContinuationPrompt(
    {
      sourceAgent: isTuiAgent(record.provider) ? record.provider : null,
      sourceKind: 'chat',
      capturedText,
      transcriptPath: read.transcriptPath ?? null
    },
    'focused'
  )
  if (!prompt) {
    return null
  }
  const promptPath = await writeAgentSessionContextSnapshot(
    context.deps.journalDatabase.stateDirectory,
    `${sessionId}:agent-switch`,
    prompt
  )
  return {
    promptPath,
    excerpt: capturedText.slice(-MAX_AGENT_SESSION_AGENT_SWITCH_EXCERPT_CHARS),
    ...(read.transcriptPath ? { transcriptPath: read.transcriptPath } : {})
  }
}

export function agentSwitchMarker(
  from: AgentSessionRecord,
  change: AgentSessionAgentSwitch,
  handoff: AgentSwitchHandoff | null
): AgentJournalPlainStatusItem {
  const toAccountLabel = accountLabel(change.accountChoice)
  const fromAccountLabel = accountLabel(from.accountChoice ?? null)
  const agentSwitch: AgentSessionAgentSwitchMark = {
    kind: change.kind,
    fromAgent: from.provider,
    toAgent: change.provider,
    ...(fromAccountLabel ? { fromAccountLabel } : {}),
    ...(toAccountLabel ? { toAccountLabel } : {}),
    ...(handoff
      ? {
          handoff: {
            excerpt: handoff.excerpt,
            ...(handoff.transcriptPath ? { transcriptPath: handoff.transcriptPath } : {})
          }
        }
      : {})
  }
  const account = toAccountLabel ?? "the host's account"
  return {
    kind: 'status',
    text:
      change.kind === 'agent'
        ? `Continued with ${formatAgentTypeLabel(change.provider)} · ${account}`
        : `Switched to ${account}`,
    presentation: AGENT_SESSION_AGENT_SWITCH_PRESENTATION,
    agentSwitch
  }
}

/** The Session History rows of the chain an agent switch retires. */
export function retiredProviderSessionIds(record: AgentSessionRecord): string[] {
  const history = structuredAgentRuntimeMetadata(record.provider)?.sessionHistory
  return record.providerHandleChain.map((link) =>
    history ? history.rowSessionId(link) : link.handle.nativeId
  )
}
