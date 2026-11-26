import { describe, expect, it } from 'vitest'
import { isPersistedAgentSessionRecord } from '../agent-session-record'
import { agentSessionConversationView } from '../leases/agent-session-conversation-view'
import { agentSessionHandedOff } from './agent-session-continued-to'
import {
  decodePersistedAgentSessionRecord,
  encodeAgentSessionRecord
} from './agent-session-record-stored-form'
import {
  agentSessionLeaseFixture,
  agentSessionRecordFixture
} from './agent-session-record.test-fixture'

const continuedTo = {
  installationId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  hostLabel: 'vps',
  sessionId: 'session-on-vps',
  worktreeId: 'workspace-vps',
  at: 5_000
}

function readBack(row: unknown) {
  const stored: unknown = JSON.parse(JSON.stringify(row))
  if (!isPersistedAgentSessionRecord(stored)) {
    throw new Error('row no longer reads as a record')
  }
  return decodePersistedAgentSessionRecord(stored)
}

describe('a chat handed off to another host', () => {
  it('keeps its mark through the stored row and stops holding its conversation once stopped', () => {
    const stopped = agentSessionLeaseFixture({
      claimStatus: 'released',
      ownerProcess: null,
      reservedSpawnToken: null,
      deathEvidence: { kind: 'exit-observed', detail: 'user-close', observedAt: 5_000 }
    })
    const { record, normalized } = readBack(
      encodeAgentSessionRecord({ ...agentSessionRecordFixture(stopped), continuedTo })
    )
    expect(normalized).toBe(false)
    expect(record.continuedTo).toEqual(continuedTo)
    expect(agentSessionHandedOff(agentSessionConversationView(record))).toBe(true)

    // Still running: the mark alone must not free the conversation.
    const live = readBack(encodeAgentSessionRecord({ ...agentSessionRecordFixture(), continuedTo }))
    expect(agentSessionHandedOff(agentSessionConversationView(live.record))).toBe(false)

    // A malformed mark is dropped and the row rewritten, not refused.
    const malformed = readBack({
      ...encodeAgentSessionRecord(agentSessionRecordFixture(stopped)),
      continuedTo: { hostLabel: '', at: 'soon' }
    })
    expect(malformed.normalized).toBe(true)
    expect(malformed.record.continuedTo).toBeUndefined()
    expect(agentSessionHandedOff(agentSessionConversationView(malformed.record))).toBe(false)

    // A mark saved before installation ids names a host only its writer understood: unknown here.
    const older = readBack({
      ...encodeAgentSessionRecord(agentSessionRecordFixture(stopped)),
      continuedTo: { executionHostId: 'local', worktreeId: 'workspace-vps', at: 5_000 }
    })
    expect(older.record.continuedTo).toEqual({ worktreeId: 'workspace-vps', at: 5_000 })
  })
})
