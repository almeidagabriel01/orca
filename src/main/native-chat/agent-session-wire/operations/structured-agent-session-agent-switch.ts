// A chat moves to another account or agent mid-conversation, as /clear does on the chat's lane.
// The same agent resumes its conversation on the new account; another agent starts fresh with the
// chat so far riding along its first turn. A person's switch withdraws the cut's automatic continue.

import type {
  AgentSessionMutationEnvelope,
  AgentSessionMutationResult
} from '../../../../shared/agent-session/agent-session-wire'
import type {
  AgentSessionAgentSwitchResult,
  AgentSessionAgentSwitchTarget
} from '../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  agentSupportsChatAccountChoice
} from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import { refuse } from '../../../../shared/agent-session/failures/agent-session-wire-refusals'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { usageLimitStopWithdrawal } from '../../../../shared/native-chat/transcript/continuation/native-chat-usage-limit-cut'
import { getClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import { claudeChatAccountChoiceProblem } from '../../../claude-accounts/selection/claude-chat-account-choice'
import {
  agentSessionAgentSwitchId,
  type AgentSessionAgentSwitch
} from '../../../runtime/agent-session/records/agent-session-agent-switch-record'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { HostUsageLimitCut } from '../recovery/structured-agent-session-usage-limit-chain'
import { attachParamsForRecord } from '../host/structured-agent-session-conversation-open'
import type { StructuredAgentSessionCaller } from '../host/structured-agent-session-host-types'
import { readHostStructuredAgentSessionWork } from '../observations/structured-agent-session-read-work'
import { hostStructuredAgentSessionCurrentWork } from '../observations/structured-agent-session-host-current-work'
import { adapterSupportsCreateIfDeclared } from '../providers/structured-agent-session-provider-support'
import { admitAndRunAgentSessionMutation } from './structured-agent-session-mutation-admission'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-mutation-context'
import { sendPreparation } from './structured-agent-session-send-preparation'
import { runAfterRewindStart } from './structured-agent-session-ready-operation'
import { conversationCommandBlocked } from './structured-conversation-command-admission'
import {
  agentSwitchMarker,
  retiredProviderSessionIds,
  type AgentSwitchHandoff
} from './structured-agent-session-agent-switch-handoff'

export type AgentSwitchParams = {
  envelope: AgentSessionMutationEnvelope
  target: AgentSessionAgentSwitchTarget
}

const METHOD = 'agentSession.switchAgent'

function invalid(message: string) {
  return {
    ok: false as const,
    refusal: refuse('agent_session_operation_invalid', { reason: 'optionRejected' }, message)
  }
}

function switchedKind(record: AgentSessionRecord | null, switchId: string) {
  const segments = record?.providerSegments ?? []
  const index = segments.findIndex((segment) => segment.switchOperationId === switchId)
  if (index === -1) {
    return null
  }
  return segments[index - 1]?.provider === segments[index].provider ? 'account' : 'agent'
}

export async function runStructuredAgentSessionAgentSwitch(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSwitchParams,
  handoff: AgentSwitchHandoff | null
): Promise<{
  result: AgentSessionMutationResult<AgentSessionAgentSwitchResult>
  /** The usage-limit cut the chat stopped on, owed one continue on its new account or agent. */
  cut: HostUsageLimitCut | null
}> {
  const { envelope, target } = params
  const { sessionId, clientOperationId } = envelope
  const { store } = context.deps
  const switchId = agentSessionAgentSwitchId(caller.callerKey, clientOperationId)
  const fields = {
    agent: target.agent,
    ...(target.accountChoice ? { accountChoice: target.accountChoice } : {})
  }
  // Written inside the lane's closures; an object keeps TypeScript from narrowing them to null.
  const done: { change: AgentSessionAgentSwitch | null; cut: HostUsageLimitCut | null } = {
    change: null,
    cut: null
  }
  const result = await runAfterRewindStart(
    context,
    caller.callerKey,
    envelope,
    { method: METHOD, fields },
    (selection) =>
      admitAndRunAgentSessionMutation<AgentSessionAgentSwitchResult>({
        store,
        adapter: context.deps.adapter,
        agents: context.deps.agents,
        logger: context.deps.logger,
        callerKey: caller.callerKey,
        envelope,
        prepareSession: sendPreparation(context, envelope, { refusesInRun: true }, selection),
        journal: () => context.sessions.get(sessionId)?.journal,
        currentWork: () =>
          hostStructuredAgentSessionCurrentWork({ store, sessions: context.sessions }, sessionId),
        readWork: (operation) =>
          readHostStructuredAgentSessionWork(
            { store, sessions: context.sessions },
            sessionId,
            operation
          ),
        publish: (journal) => context.publish(sessionId, journal),
        now: context.now,
        plan: {
          method: METHOD,
          fields,
          conversationWrite: true,
          recoverUnknownFromDurableState: true,
          settlesWithWrite: true,
          successReceipt: () =>
            store.conversationReceipts.agentSwitch(
              () => {
                if (!done.change) {
                  throw new Error('agent_session_agent_switch_not_completed')
                }
                return done.change
              },
              { callerKey: caller.callerKey, operationId: clientOperationId }
            ),
          replay: () => {
            const kind = switchedKind(store.getRecord(sessionId), switchId)
            return kind ? { kind, continued: false } : null
          },
          // No committed switch means no effects but a stopped agent, which the next send restarts.
          rerunWhenReplayMissing: () => true,
          run: async (ctx) => {
            const record = store.requireWritableRecord(sessionId)
            const kind = record.provider === target.agent ? 'account' : 'agent'
            const accountChoice =
              target.accountChoice === undefined || target.accountChoice === AGENT_CHAT_HOST_ACCOUNT
                ? null
                : target.accountChoice
            if (
              kind === 'agent' &&
              (!context.deps.agents.definition(target.agent) ||
                !adapterSupportsCreateIfDeclared(
                  context.deps.adapter,
                  record.location,
                  target.agent
                ))
            ) {
              return invalid(
                `This chat can't continue with ${formatAgentTypeLabel(target.agent)} here.`
              )
            }
            if (kind === 'account' && accountChoice === (record.accountChoice ?? null)) {
              return invalid('This chat already runs on that account.')
            }
            if (accountChoice !== null) {
              const problem = !agentSupportsChatAccountChoice(target.agent)
                ? `${formatAgentTypeLabel(target.agent)} chats run on the host's account.`
                : record.location.wslDistro !== null
                  ? 'A chat in WSL runs on the account its distro selects.'
                  : claudeChatAccountChoiceProblem(getClaudeProfileRouter(), accountChoice)
              if (problem) {
                return invalid(problem)
              }
            }
            const childWork = () => ({
              views: context.readChildWork(sessionId),
              open: context.childWorkOpen(sessionId)
            })
            const blocked = await conversationCommandBlocked(
              ctx,
              record,
              childWork(),
              context.sessions.get(sessionId)?.child ? undefined : 'at-rest'
            )
            if (blocked) {
              return { ok: false, refusal: blocked }
            }
            // Read before the divider: a cut is only the latest one in its own context.
            done.cut = await ctx.journal.reads.usageLimitCut()
            await context.stopAgent(sessionId, { cause: 'context-clear' })
            const stopped = store.requireWritableRecord(sessionId)
            const fence = stopped.lease.runtimeFence
            const rechecked = await conversationCommandBlocked(
              { ...ctx, fence },
              stopped,
              childWork(),
              'at-rest'
            )
            if (rechecked) {
              return { ok: false, refusal: rechecked }
            }
            const accountHome =
              kind === 'agent'
                ? await context.deps.launchAccountHome?.(
                    {
                      ...stopped,
                      provider: target.agent,
                      accountChoice: accountChoice ?? undefined
                    },
                    'identity'
                  )
                : undefined
            if (kind === 'agent' && !accountHome) {
              return invalid(
                `Orca can't tell which account ${formatAgentTypeLabel(target.agent)} would use here.`
              )
            }
            const now = context.now()
            const withdrawCut = usageLimitStopWithdrawal(done.cut)
            const shownHandoff = kind === 'agent' ? handoff : null
            const change: AgentSessionAgentSwitch = {
              sessionId,
              fence,
              switchId,
              kind,
              provider: target.agent,
              ...(accountHome ? { accountHome } : {}),
              accountChoice,
              ...(shownHandoff
                ? { pendingHandoff: { operationId: switchId, promptPath: shownHandoff.promptPath } }
                : {}),
              ...(withdrawCut ? { withdrawCut } : {}),
              ...(kind === 'agent'
                ? { retiredProviderSessionIds: retiredProviderSessionIds(stopped) }
                : {}),
              now
            }
            done.change = change
            const marker = agentSwitchMarker(stopped, change, shownHandoff)
            if (!ctx.operationReceipt) {
              throw new Error('agent_session_agent_switch_receipt_missing')
            }
            const receipt = () => ({ receipt: ctx.operationReceipt })
            if (kind === 'agent') {
              await ctx.journal.write(
                {
                  kind: 'context-clear',
                  boundary: { operationId: switchId, afterFence: fence, clearedAt: now },
                  divider: marker
                },
                receipt
              )
              const session = context.sessions.get(sessionId)
              const moved = store.getConversation(sessionId)
              if (session && moved) {
                session.params = attachParamsForRecord(moved, {
                  clientOperationId: session.params.envelope.clientOperationId,
                  expectedRuntimeFence: fence
                })
                // What the chat sends from now on belongs to the new agent's conversation.
                session.journal.identity = {
                  ...session.journal.identity,
                  agent: target.agent,
                  providerHandle: null
                }
              }
            } else {
              await ctx.journal.write(
                {
                  kind: 'item',
                  identity: { provider: 'orca', clientMessageId: `agent-switch:${switchId}` },
                  body: marker,
                  options: { fence, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
                },
                receipt
              )
            }
            return { ok: true, value: { kind, continued: false } }
          }
        }
      })
  )
  if (result.ok && !result.replayed && done.change?.kind === 'agent') {
    context.clearPromptSuggestion?.(sessionId)
  }
  return { result, cut: result.ok && !result.replayed ? done.cut : null }
}
