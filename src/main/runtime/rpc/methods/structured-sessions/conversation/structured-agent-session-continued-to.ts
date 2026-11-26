import { MarkContinuedToParams } from '../../../../../../shared/rpc-contract/structured-agent-session/mark-continued-to-params'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_CONTINUED_TO_METHODS = [
  defineMethod({
    // A chat handed off to another host: saved on its record, then stopped here, so every device
    // reads it as continued and the conversation never has two live chats.
    name: 'agentSession.markContinuedTo',
    permission: 'workspace',
    params: MarkContinuedToParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      await host.markContinuedTo(params.sessionId, {
        ...(params.installationId ? { installationId: params.installationId } : {}),
        hostLabel: params.hostLabel,
        ...(params.continuedSessionId ? { sessionId: params.continuedSessionId } : {}),
        ...(params.worktreeId ? { worktreeId: params.worktreeId } : {}),
        at: Date.now()
      })
      // Stops the provider and releases the lease; the record and journal stay readable.
      await host.close(params.sessionId, 'user-close')
      return { ok: true as const }
    }
  })
]
