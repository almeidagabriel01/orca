import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../db/orchestration-db'
import { createRootDispatch } from '../../db/root-dispatch-test-fixture'
import { structuredWorkerDispatchesSettled } from './structured-worker-custody'
import { structuredWorkerProcessIncarnation } from './structured-worker-incarnation'

describe('structuredWorkerDispatchesSettled', () => {
  let db: OrchestrationDb
  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
  })
  afterEach(() => db.close())

  const dispatchTo = (sessionId: string) =>
    createRootDispatch(
      db,
      db.createTask({ runId: 'run_legacy_local', spec: 'work' }).id,
      'term_worker',
      undefined,
      undefined,
      structuredWorkerProcessIncarnation(sessionId)
    ).id

  it('is settled only for a worker with Dispatch history and none still open', () => {
    const chat = { sessionId: 'session-1' }
    expect(structuredWorkerDispatchesSettled(db, chat)).toBe(false)
    const first = dispatchTo(chat.sessionId)
    expect(structuredWorkerDispatchesSettled(db, chat)).toBe(false)
    db.completeDispatch(first)
    expect(structuredWorkerDispatchesSettled(db, chat)).toBe(true)
    dispatchTo(chat.sessionId)
    expect(structuredWorkerDispatchesSettled(db, chat)).toBe(false)
    expect(structuredWorkerDispatchesSettled(null, chat)).toBe(false)
  })
})
