import { conversationCommandInFlight } from './structured-conversation-command-admission'
import { sendStructuredAgentSessionTurn } from './structured-agent-session-host-mutations'
import {
  runStructuredConversationCommand,
  type ConversationCommandParams
} from './structured-conversation-command'
import { runStructuredCompaction } from './structured-conversation-compaction'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-mutation-context'
import type { StructuredAgentSessionCaller } from '../host/structured-agent-session-host-types'
import type { StructuredAgentSessionHost } from '../host/structured-agent-session-host'
import { refuseUnclassified } from '../../../../shared/agent-session/failures/agent-session-wire-refusals'
import { usageLimitContinueMutation } from '../recovery/structured-agent-session-usage-limit-continue-message'
import {
  runStructuredAgentSessionAgentSwitch,
  type AgentSwitchParams
} from './structured-agent-session-agent-switch'
import { prepareAgentSwitchHandoff } from './structured-agent-session-agent-switch-handoff'

export class StructuredConversationCommandController {
  /** Clear changes send context; compaction instead queues ahead of later sends. */
  readonly pending = new Map<string, { key: string; count: number }>()
  constructor(
    private readonly context: () => StructuredAgentSessionMutationContext,
    private readonly host: Pick<
      StructuredAgentSessionHost,
      'waitForSendSettlement' | 'continuationContext'
    >
  ) {}
  /** Refuse only first-run sends during clear; recorded IDs still replay their answers. */
  send = (
    caller: StructuredAgentSessionCaller,
    params: Parameters<typeof sendStructuredAgentSessionTurn>[2]
  ): ReturnType<typeof sendStructuredAgentSessionTurn> =>
    sendStructuredAgentSessionTurn(this.context(), caller, params, {
      clearInFlight: this.pending.has(params.envelope.sessionId)
    })

  run = (caller: StructuredAgentSessionCaller, params: ConversationCommandParams) => {
    if (params.command === 'compact') {
      return runStructuredCompaction(this.context(), this.host, caller, params, {
        clearInFlight: this.pending.has(params.envelope.sessionId)
      })
    }
    return (
      this.exclusive(caller, params.envelope, () =>
        runStructuredConversationCommand(this.context(), caller, params)
      ) ?? Promise.resolve({ ok: false as const, refusal: conversationCommandInFlight() })
    )
  }

  switchAgent = async (caller: StructuredAgentSessionCaller, params: AgentSwitchParams) => {
    const { sessionId } = params.envelope
    const switched = await this.exclusive(caller, params.envelope, async () => {
      // A handoff that can't be read refuses: the other agent must not start without the chat.
      const handoff = await prepareAgentSwitchHandoff(
        this.context(),
        this.host,
        sessionId,
        params.target
      ).catch((error: unknown) => {
        this.context().deps.logger.warn('agent switch handoff failed', {
          scope: 'agent-switch',
          sessionId,
          error
        })
        return undefined
      })
      if (handoff === undefined) {
        return {
          result: {
            ok: false as const,
            refusal: refuseUnclassified(
              'agent_session_operation_invalid',
              "Orca couldn't gather this chat for the other agent. Nothing changed; try again."
            )
          },
          cut: null
        }
      }
      return runStructuredAgentSessionAgentSwitch(this.context(), caller, params, handoff)
    })
    if (!switched) {
      return { ok: false as const, refusal: conversationCommandInFlight() }
    }
    const { result, cut } = switched
    const fence = this.context().deps.store.getRecord(sessionId)?.lease.runtimeFence
    if (!result.ok || !cut || fence === undefined) {
      return result
    }
    // Sent after leaving pending, which refuses first-run sends; the switch withdrew the sweep's.
    try {
      const sent = await this.send(
        { callerKey: 'trusted-local:usage-limit-continue' },
        await usageLimitContinueMutation({
          sessionId,
          cut,
          at: this.context().now(),
          expectedRuntimeFence: fence
        })
      )
      return { ...result, value: { ...result.value, continued: sent.ok } }
    } catch (error) {
      this.context().deps.logger.warn('agent switch continue failed', {
        scope: 'agent-switch',
        sessionId,
        error
      })
      return result
    }
  }

  /** Clear and switch hold first-run sends; null when another such operation holds the chat. */
  private exclusive<T>(
    caller: StructuredAgentSessionCaller,
    envelope: AgentSwitchParams['envelope'],
    run: () => Promise<T>
  ): Promise<T> | null {
    const { sessionId } = envelope
    const key = JSON.stringify([caller.callerKey, envelope.clientOperationId])
    const pending = this.pending.get(sessionId)
    if (pending && pending.key !== key) {
      return null
    }
    const entry = pending ?? { key, count: 0 }
    entry.count++
    this.pending.set(sessionId, entry)
    return run().finally(() => {
      if (--entry.count === 0 && this.pending.get(sessionId) === entry) {
        this.pending.delete(sessionId)
      }
      // Refusals may write no row; wake drafts without waiting for an unrelated commit.
      this.context().wakeQueuedDrain?.(sessionId)
    })
  }
}
