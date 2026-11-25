import { describe, expect, it, vi } from 'vitest'
import { codexProviderHandle } from '../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import { createStructuredAgentSessionRestartResume } from './structured-agent-session-restart-resume-host'
import {
  marker,
  record,
  SESSION,
  THREAD
} from './testing/structured-agent-session-restart-resume.test-fixture'

// A worker that reported done keeps its restart offer for a person; only the launch's automatic run skips it.
function restartResume(workerDispatchesSettled: boolean) {
  const capsule = {
    list: vi.fn(async () => [marker()]),
    listFailed: vi.fn(async () => []),
    beginResume: vi.fn(async () => []),
    completeResume: vi.fn(async () => {}),
    failResume: vi.fn(async () => {}),
    rollbackResume: vi.fn(async () => {}),
    forgetSuperseded: vi.fn(async () => {})
  }
  const handle = codexProviderHandle(THREAD)
  const deps = {
    store: { getRecord: () => record(), getConversation: () => record() },
    adapter: {},
    recoveryCapsule: capsule,
    logger: { warn: () => {}, info: () => {}, error: () => {} },
    agents: {
      definition: () => ({
        agent: handle.agent,
        handleTransport: handle.transport,
        accountHomeVariable: 'CODEX_HOME'
      })
    },
    journalDatabase: { readOnly: false },
    workerDispatchesSettled: () => workerDispatchesSettled
  }
  const resume = createStructuredAgentSessionRestartResume(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the members a restart action reads are supplied.
    deps as unknown as Parameters<typeof createStructuredAgentSessionRestartResume>[0],
    new Map(),
    {
      revealSession: async () => ({ readable: true }),
      send: vi.fn(),
      awaitSendSettlement: vi.fn(),
      awaitSendHandedOver: vi.fn(),
      awaitSendDispatched: vi.fn(),
      readChildWork: () => [],
      childWorkOpen: () => false,
      now: () => 1_700_000_000_000
    }
  )
  return { resume, capsule }
}

describe('restart resume of a finished worker chat', () => {
  it('is listed and resumable by hand, but never continued automatically', async () => {
    const finished = restartResume(true)
    await finished.resume.continueAfterRestart(undefined, 'launch', undefined, { automatic: true })
    expect(finished.capsule.beginResume).not.toHaveBeenCalled()
    expect(finished.capsule.forgetSuperseded).not.toHaveBeenCalled()
    expect((await finished.resume.list()).map((row) => row.sessionId)).toEqual([SESSION])
    await finished.resume.continueAfterRestart([SESSION], 'person', undefined)
    expect(finished.capsule.beginResume.mock.calls[0]?.[0]).toEqual([SESSION])

    const working = restartResume(false)
    await working.resume.continueAfterRestart(undefined, 'launch', undefined, { automatic: true })
    expect(working.capsule.beginResume.mock.calls[0]?.[0]).toEqual([SESSION])
  })
})
