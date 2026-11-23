import { afterEach, expect, it } from 'vitest'
import { agentSessionFailureFact } from '../../../../shared/agent-session/failures/agent-session-failure'
import { agentSessionFailureWords } from '../../../../shared/agent-session/failures/agent-session-failure-words'
import {
  agentJournalItemKey,
  agentJournalSubmissionKey
} from '../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { NATIVE_CHAT_USAGE_LIMIT_CONTINUE_MESSAGE } from '../../../../shared/native-chat/transcript/continuation/native-chat-usage-limit-cut'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { activeProviderContext } from '../../../../shared/agent-session/conversation-context/agent-session-provider-context'
import {
  agentSessionAccountHomePath,
  type AgentSessionAccountHome
} from '../../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import { computeAgentSessionPayloadFingerprint } from '../../../../shared/agent-session/lifecycle/operations/agent-session-mutation-envelope'
import type { ProviderRateLimits } from '../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { usageLimitContinueMutation } from './structured-agent-session-usage-limit-continue-message'
import type { HostUsageLimitCut } from './structured-agent-session-usage-limit-chain'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION,
  HOST_TEST_THREAD as THREAD,
  hostTestAttachParams,
  hostTestOperationId
} from '../host/testing/structured-agent-session-host-test-data.test-fixture'
import {
  createQueuedMessageTestRig,
  QUEUED_RIG_CALLER,
  type QueuedMessageTestRig
} from '../host/testing/structured-agent-session-queued-message-rig.test-fixture'
import { eventually } from '../host/testing/structured-agent-session-queued-message-rig-provider.test-fixture'

const RESET = NOW + 60_000
const SWEEP_CALLER = 'trusted-local:usage-limit-continue'
// Past the reset and its grace, then a day of passes, every one with room on the account.
const PASSES = [5_000, 20_000, 40_000, 80_000, 120_000, 600_000, 3_600_000]
const HOMES = {
  codexA: { variable: 'CODEX_HOME', path: '/fixture/codex-a' },
  codexB: { variable: 'CODEX_HOME', path: '/fixture/codex-b' },
  claudeHost: { variable: 'CLAUDE_CONFIG_DIR', path: '/fixture/claude-host' },
  claudeSystem: { variable: 'CLAUDE_CONFIG_DIR', path: '/fixture/claude-system' }
} as const satisfies Record<string, AgentSessionAccountHome>

let rig: QueuedMessageTestRig | undefined
afterEach(async () => rig?.dispose())

const room = (updatedAt: number): ProviderRateLimits => ({
  provider: 'codex',
  session: null,
  weekly: { usedPercent: 0, windowMinutes: 10_080, resetsAt: RESET, resetDescription: null },
  updatedAt,
  error: null,
  status: 'ok'
})

/** A chat on `start` cut by a usage limit; a codex chat then relaunches on another account, as the
 *  only way its unknown reset is ever continued without a switch. */
async function cutChat(start: 'codex' | 'claude', resetsAt: number | null) {
  let clock = NOW
  let codexHome: AgentSessionAccountHome = HOMES.codexA
  const launchHome = (record: { provider: string; accountChoice?: string } | null) =>
    (record?.provider ?? start) === 'codex'
      ? codexHome
      : record?.accountChoice === 'system'
        ? HOMES.claudeSystem
        : HOMES.claudeHost
  // The first acquire runs inside the rig's creation, before `current` exists.
  let created: QueuedMessageTestRig | undefined
  const current: QueuedMessageTestRig = await createQueuedMessageTestRig({
    now: () => clock,
    restartable: true,
    ...(start === 'claude' ? { agent: 'claude' as const } : {}),
    acquiredAccountHome: () => launchHome(created?.store.getRecord(SESSION) ?? null),
    hostDeps: { launchAccountHome: async (record) => launchHome(record) },
    usageLimitAutoContinue: {
      isEnabled: () => true,
      isWorkspaceAsleep: () => false,
      subscribe: () => () => {},
      accountUsage: async (_provider, home) => {
        const path = agentSessionAccountHomePath(home) ?? ''
        return { scope: path, account: { key: path, read: () => room(clock), refresh: () => true } }
      }
    }
  })
  rig = created = current
  const { store } = current
  const fence = () => store.getRecord(SESSION)!.lease.runtimeFence
  const ready = () =>
    eventually(() =>
      expect(current.host.collaboratorsForTests().sessions.get(SESSION)?.child?.phase).toBe('ready')
    )
  await ready()
  expect(store.getRecord(SESSION)?.launchedAccount?.accountHome).toEqual(launchHome(null))
  await store.setSessionTabVisibility(SESSION, true)
  const journal = (await current.host.conversation(SESSION)).journal
  const cutFence = fence()
  const turn = { provider: 'orca' as const, clientMessageId: 'usage-limited' }
  await journal.appendItem(
    turn,
    {
      kind: 'turn',
      turnId: 'usage-limited',
      providerTurnId: 'usage-limited',
      state: 'completed',
      outcome: 'failure',
      startedAt: NOW,
      completedAt: NOW
    },
    { fence: cutFence, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'limit' },
    {
      kind: 'status',
      ...agentSessionFailureWords(
        agentSessionFailureFact(
          'usageLimitReached',
          resetsAt === null ? {} : { usageLimit: { resetsAt } }
        ),
        { surface: 'row' }
      )
    },
    { fence: cutFence, turnScope: { kind: 'turn', turnItemId: agentJournalItemKey(turn) } }
  )
  if (start === 'codex') {
    codexHome = HOMES.codexB
    const { lifetime } = current.host.collaboratorsForTests()
    await current.host.serialize(SESSION, () =>
      lifetime.stopAgent(SESSION, { cause: 'evict', resting: true })
    )
    expect(
      await current.host.attach(QUEUED_RIG_CALLER, hostTestAttachParams(fence()))
    ).toMatchObject({ ok: true })
    await ready()
  }
  expect(await journal.reads.usageLimitCut()).toMatchObject({ fence: cutFence })

  const sends: unknown[] = []
  const countSweepSends = () => {
    const { host } = current
    const send = host.send
    host.send = (caller, params) => {
      if (caller.callerKey === SWEEP_CALLER) {
        sends.push(params)
      }
      return send(caller, params)
    }
  }
  countSweepSends()

  return {
    current,
    journal,
    sends,
    at: (offset: number) => {
      clock = NOW + offset
    },
    /** One sweep pass per offset; the sweep's send attempts each pass made. */
    sweep: async (offsets: readonly number[]) => {
      const made: number[] = []
      for (const offset of offsets) {
        clock = NOW + offset
        const before = sends.length
        await current.host.usageLimitContinue.tick()
        made.push(sends.length - before)
      }
      return made
    },
    restartHost: () => {
      current.crashRestartHostProcess()
      countSweepSends()
    },
    /** With `lose`, the continue the switch sends is lost before it could be confirmed. */
    switchTo: async (agent: 'codex' | 'claude', accountChoice?: string, lose = false) => {
      const fields = { agent, ...(accountChoice ? { accountChoice } : {}) }
      const commands = current.host.conversationCommands
      const send = commands.send
      if (lose) {
        commands.send = (caller, params) => {
          if (caller.callerKey === SWEEP_CALLER) {
            throw new Error('lost before it could be confirmed')
          }
          return send(caller, params)
        }
      }
      return commands
        .switchAgent(QUEUED_RIG_CALLER, {
          envelope: {
            sessionId: SESSION,
            clientOperationId: hostTestOperationId(),
            expectedRuntimeFence: fence(),
            payloadFingerprint: computeAgentSessionPayloadFingerprint({
              method: 'agentSession.switchAgent',
              sessionId: SESSION,
              fields
            })
          },
          target: fields
        })
        .finally(() => {
          commands.send = send
        })
    },
    /** A continue of `cut` as the switch's controller sends it. */
    continueCut: async (cut: HostUsageLimitCut) =>
      current.host.conversationCommands.send(
        { callerKey: SWEEP_CALLER },
        await usageLimitContinueMutation({
          sessionId: SESSION,
          cut,
          at: clock,
          expectedRuntimeFence: fence()
        })
      ),
    /** The destination agent takes `id` and finishes its turn, as the mail rig settles one. */
    finishTurn: async (id: string) => {
      const record = store.getRecord(SESSION)!
      const thread = activeProviderContext(record).head?.handle.nativeId ?? THREAD
      const identity = (name: string) =>
        record.provider === 'claude'
          ? { provider: 'claude' as const, sessionId: thread, uuid: name }
          : { provider: 'codex' as const, threadId: thread, turnId: name, ordinal: 0 }
      await current.host.settleLateDispatch({
        sessionId: SESSION,
        clientMessageId: id,
        providerIdentity: identity('accepted-continue')
      })
      await journal.appendItem(
        identity('completed-continue'),
        {
          kind: 'turn',
          turnId: 'completed-continue',
          userItemId: agentJournalSubmissionKey(id),
          state: 'completed',
          outcome: 'success',
          startedAt: clock,
          completedAt: clock
        },
        { fence: record.lease.runtimeFence, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
      )
    },
    hostSubmissions: async () =>
      (await journal.reads.pendingSubmissions()).filter(({ origin }) => origin === 'host')
  }
}

const CUT_TURN = agentJournalItemKey({ provider: 'orca', clientMessageId: 'usage-limited' })
const cases = [
  { start: 'codex', to: 'claude', choice: undefined, kind: 'agent' },
  { start: 'claude', to: 'codex', choice: undefined, kind: 'agent' },
  { start: 'claude', to: 'claude', choice: 'system', kind: 'account' }
] as const
const withResets = cases.flatMap((c) => [RESET, null].map((resetsAt) => ({ ...c, resetsAt })))

it.each([RESET, null])('the sweep continues a cut nobody switched (reset %s)', async (resetsAt) => {
  const chat = await cutChat('codex', resetsAt)
  expect(await chat.sweep(PASSES)).toEqual([0, 1, 0, 0, 0, 0, 0])
})

it('the sweep continues a known-reset claude cut nobody switched', async () => {
  const chat = await cutChat('claude', RESET)
  expect(await chat.sweep(PASSES)).toEqual([0, 0, 0, 1, 0, 0, 0])
})

it.each(withResets)(
  'a $kind switch from $start to $to sends one continue and the sweep none (reset $resetsAt)',
  async ({ start, to, choice, kind, resetsAt }) => {
    const chat = await cutChat(start, resetsAt)
    const cut = (await chat.journal.reads.usageLimitCut())!
    chat.at(1_000)
    expect(await chat.switchTo(to, choice)).toMatchObject({
      ok: true,
      value: { kind, continued: true }
    })
    expect(chat.current.store.getRecord(SESSION)?.usageLimitContinueCancel).toEqual({
      turnItemId: CUT_TURN,
      resetsAt: resetsAt ?? 0
    })
    expect(await chat.hostSubmissions()).toHaveLength(1)
    // An agent switch hands the chat so far to the new agent in front of the continue, once.
    await eventually(() => expect(chat.current.dispatch).toHaveBeenCalledTimes(1))
    const sent = chat.current.dispatch.mock.calls[0]![0].body.blocks[0]
    const text = sent?.type === 'text' ? sent.text : ''
    if (kind === 'agent') {
      expect(text.endsWith(`\n\n${NATIVE_CHAT_USAGE_LIMIT_CONTINUE_MESSAGE}`)).toBe(true)
      expect(text.length).toBeGreaterThan(NATIVE_CHAT_USAGE_LIMIT_CONTINUE_MESSAGE.length + 2)
      await eventually(() =>
        expect(chat.current.store.getRecord(SESSION)?.pendingHandoff).toBeUndefined()
      )
    } else {
      expect(text).toBe(NATIVE_CHAT_USAGE_LIMIT_CONTINUE_MESSAGE)
    }
    expect(await chat.continueCut(cut)).toMatchObject({
      ok: false,
      refusal: { details: { reason: 'continuationSuperseded' } }
    })
    expect(await chat.sweep(PASSES)).toEqual(PASSES.map(() => 0))
    chat.restartHost()
    expect(await chat.sweep(PASSES.map((offset) => offset + 3_600_000))).toEqual(
      PASSES.map(() => 0)
    )
    expect(await chat.hostSubmissions()).toHaveLength(1)
  }
)

// Only the withdrawal holds the sweep here: the cut stays the chat's latest, owed nothing yet.
it.each(withResets)(
  'a $kind switch from $start to $to whose continue is lost leaves the sweep none (reset $resetsAt)',
  async ({ start, to, choice, kind, resetsAt }) => {
    const chat = await cutChat(start, resetsAt)
    chat.at(1_000)
    expect(await chat.switchTo(to, choice, true)).toMatchObject({
      ok: true,
      value: { kind, continued: false }
    })
    expect(await chat.journal.reads.usageLimitCut()).toMatchObject({ turnItemId: CUT_TURN })
    expect(await chat.sweep(PASSES)).toEqual(PASSES.map(() => 0))
    chat.restartHost()
    expect(await chat.sweep(PASSES.map((offset) => offset + 3_600_000))).toEqual(
      PASSES.map(() => 0)
    )
    expect(await chat.hostSubmissions()).toEqual([])
  }
)

it.each(cases)(
  'a $kind switch from $start to $to continues ahead of the mail the cut held, then delivers it',
  async ({ start, to, choice, kind }) => {
    const chat = await cutChat(start, RESET)
    const mail = await chat.current.send('check the build', 'queue-if-active', {
      internal: true,
      from: { kind: 'agent', senders: [], orchestration: null }
    }).result
    if (!mail.ok || !('queued' in mail.value)) {
      throw new Error('Expected mail to queue behind the failed turn')
    }
    const card = mail.value.queued.messageId
    expect(await chat.current.queuePause()).toEqual({ reason: 'failed' })
    chat.at(1_000)
    expect(await chat.switchTo(to, choice)).toMatchObject({
      ok: true,
      value: { kind, continued: true }
    })
    const [continued] = await chat.hostSubmissions()
    const id = continued!.clientMessageId
    await eventually(async () =>
      expect((await chat.current.submission(id))?.handedOverAt).toBeDefined()
    )
    expect(await chat.current.handoff(card)).toBeUndefined()
    await chat.finishTurn(id)
    await eventually(async () =>
      expect((await chat.current.handoff(card))?.handedOverAt).toBeDefined()
    )
    expect(await chat.sweep(PASSES)).toEqual(PASSES.map(() => 0))
  }
)
