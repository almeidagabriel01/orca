import type { AgentSessionMutationResult } from '../../../../../shared/agent-session/agent-session-wire'
import type {
  AgentSessionAgentSwitchResult,
  AgentSessionAgentSwitchTarget
} from '../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import {
  createStructuredAgentSessionOperationId,
  structuredAgentSessionPayloadFingerprint
} from '../../../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import {
  agentSessionRefusalFailure,
  agentSessionThrownFailure
} from '../../../../../shared/agent-session/failures/agent-session-write-failure'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { RuntimeRpcCallError } from '@/runtime/rpc/calls/runtime-rpc-result'
import { agentSessionWriteFailureText } from '@/components/native-chat/messages/notices/agent-session-write-notice-text'
import { callStructuredAgentSession } from './structured-agent-session-call'

export type StructuredAgentSessionAgentSwitchOutcome =
  | { kind: 'accepted'; result: AgentSessionAgentSwitchResult }
  | { kind: 'failed'; text: string }

/** Continues the chat on another agent or account in place; the host writes the marker row. */
export async function switchStructuredAgentSessionAgent(
  target: RuntimeClientTarget,
  sessionId: string,
  fence: number,
  { agent, accountChoice }: AgentSessionAgentSwitchTarget
): Promise<StructuredAgentSessionAgentSwitchOutcome> {
  const method = 'agentSession.switchAgent'
  const fields = { agent, ...(accountChoice ? { accountChoice } : {}) }
  try {
    const result = await callStructuredAgentSession<
      AgentSessionMutationResult<AgentSessionAgentSwitchResult>
    >(target, method, {
      envelope: {
        sessionId,
        clientOperationId: createStructuredAgentSessionOperationId(createBrowserUuid),
        expectedRuntimeFence: fence,
        payloadFingerprint: structuredAgentSessionPayloadFingerprint({ method, sessionId, fields })
      },
      target: fields
    })
    return result.ok
      ? { kind: 'accepted', result: result.value }
      : {
          kind: 'failed',
          text: agentSessionWriteFailureText(agentSessionRefusalFailure(result.refusal), 'option')
        }
  } catch (error) {
    const failure = agentSessionThrownFailure(
      error,
      error instanceof RuntimeRpcCallError ? error.code : undefined
    )
    return { kind: 'failed', text: agentSessionWriteFailureText(failure, 'option') }
  }
}
