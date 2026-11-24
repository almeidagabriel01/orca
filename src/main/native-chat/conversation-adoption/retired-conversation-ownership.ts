import type { AgentSessionConversationView } from '../../../shared/agent-session/lifecycle/leases/agent-session-conversation-view'
import { structuredAgentRuntimeMetadata } from '../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import {
  listStructuredProviderSessionOwnership,
  type StructuredProviderSessionOwnership
} from '../agent-session-wire/host/structured-provider-session-ownership'
import { conversationFamily } from './structured-conversation-key'

/** Every conversation a chat holds: its chain's, then those of agents it switched away from. */
export function listChatProviderSessionOwnership(
  records: readonly AgentSessionConversationView[]
): StructuredProviderSessionOwnership[] {
  return [
    ...listStructuredProviderSessionOwnership(records),
    ...records.flatMap((record) =>
      (record.retiredConversations ?? []).flatMap(({ provider, accountHome, providerSessionIds }) =>
        structuredAgentRuntimeMetadata(provider)?.sessionHistory
          ? providerSessionIds.map((providerSessionId) => ({
              sessionId: record.sessionId,
              wslDistro: record.location.wslDistro,
              workspaceId: record.location.workspaceId,
              provider,
              providerSessionId,
              conversationName: record.conversationName,
              ownerObservation: record.ownerObservation,
              role: 'earlier' as const,
              key: {
                family: conversationFamily(provider),
                id: providerSessionId,
                home: accountHome
              }
            }))
          : []
      )
    )
  ]
}
