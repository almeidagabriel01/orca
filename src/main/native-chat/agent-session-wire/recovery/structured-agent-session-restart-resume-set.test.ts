import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../../runtime/orchestration/db/orchestration-db'
import { createRootDispatch } from '../../../runtime/orchestration/db/root-dispatch-test-fixture'
import { structuredWorkerDispatchesSettled } from '../../../runtime/orchestration/terminal-authority/structured-sessions/structured-worker-custody'
import { structuredWorkerProcessIncarnation } from '../../../runtime/orchestration/terminal-authority/structured-sessions/structured-worker-incarnation'
import { structuredAgentSessionResumableSet } from './structured-agent-session-restart-resume-set'
import {
  marker,
  record,
  SESSION
} from './testing/structured-agent-session-restart-resume.test-fixture'

describe('restart offers of orchestration worker chats', () => {
  let db: OrchestrationDb
  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
  })
  afterEach(() => db.close())

  const dispatchToSession = () =>
    createRootDispatch(
      db,
      db.createTask({ runId: 'run_legacy_local', spec: 'work' }).id,
      'term_worker',
      undefined,
      undefined,
      structuredWorkerProcessIncarnation(SESSION)
    ).id

  const offered = async () =>
    (
      await structuredAgentSessionResumableSet({
        markers: [marker()],
        getRecord: () => record(),
        supportsRecord: () => true,
        latestPrompt: () => 'work',
        movedOn: () => false,
        savedByNewerOrca: () => false,
        workerDispatchesSettled: (chat) => structuredWorkerDispatchesSettled(db, chat)
      })
    ).candidates.map((candidate) => candidate.sessionId)

  it('never continues a worker whose Dispatch settled, but does a live worker and a plain chat', async () => {
    expect(await offered()).toEqual([SESSION])
    const first = dispatchToSession()
    expect(await offered()).toEqual([SESSION])
    db.completeDispatch(first)
    expect(await offered()).toEqual([])
    dispatchToSession()
    expect(await offered()).toEqual([SESSION])
  })
})
