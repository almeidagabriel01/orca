import { expect, it } from 'vitest'
import { agentSessionConversationView } from '../../../../shared/agent-session/lifecycle/leases/agent-session-conversation-view'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import { projectStructuredAgentSessionStatusState } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { structuredAgentSessionStatusSummary } from './structured-agent-session-status-summary'

const summaryOf = (accountChoice: string | undefined, launchAccountChoice: string | undefined) => {
  const saved = agentSessionRecordFixture()
  const record = agentSessionConversationView(accountChoice ? { ...saved, accountChoice } : saved)
  return structuredAgentSessionStatusSummary({
    sessionId: record.sessionId,
    session: { params: { location: record.location, provider: record.provider } },
    lastActivityAt: 1,
    record,
    launchAccountChoice,
    state: projectStructuredAgentSessionStatusState([]),
    stopping: false,
    childWork: {},
    namingFailure: undefined,
    now: () => 1
  })
}

it("counts a chat without a saved account against the account it launches on, the project's default", () => {
  expect(summaryOf(undefined, 'beyond').accountChoice).toBe('beyond')
  expect(summaryOf('own', 'own').accountChoice).toBe('own')
  // A host without the launch read reports the record's own account.
  expect(summaryOf('own', undefined).accountChoice).toBe('own')
  expect(summaryOf(undefined, undefined).accountChoice).toBeUndefined()
})
