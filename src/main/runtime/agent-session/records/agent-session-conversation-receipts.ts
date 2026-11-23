import type { AgentSessionForkedFrom } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { AgentSessionStoreTransactions } from './agent-session-store-transactions'
import type { AgentSessionConversationClear } from './agent-session-conversation-command-record'
import type { AgentSessionAgentSwitch } from './agent-session-agent-switch-record'
import type { AgentSessionRewindRecord } from '../../../../shared/agent-session/lifecycle/rewind/agent-session-rewind'

export function createAgentSessionConversationReceipts(
  transactions: Pick<AgentSessionStoreTransactions, 'mutationReceipt'>
) {
  return {
    forkBoundary: (sessionId: string, forkedFrom: AgentSessionForkedFrom) =>
      transactions.mutationReceipt({ kind: 'fork-boundary', sessionId, forkedFrom }),
    clear: (
      clear: () => AgentSessionConversationClear,
      operation: { callerKey: string; operationId: string }
    ) => transactions.mutationReceipt(() => ({ kind: 'clear', clear: clear(), operation })),
    agentSwitch: (
      change: () => AgentSessionAgentSwitch,
      operation: { callerKey: string; operationId: string }
    ) =>
      transactions.mutationReceipt(() => ({ kind: 'agent-switch', change: change(), operation })),
    rewind: (sessionId: string, fence: number, rewind: AgentSessionRewindRecord) =>
      transactions.mutationReceipt({ kind: 'rewind-complete', sessionId, fence, rewind })
  }
}
