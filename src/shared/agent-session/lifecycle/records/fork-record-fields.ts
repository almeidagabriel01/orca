// The fork's fields mixed into the session record, in one import so the record file keeps its line budget.
import type { AgentSessionSwitchFields } from '../../conversation-context/agent-session-agent-switch'
import type { AgentSessionContinuation } from './agent-session-continued-to'

export { isAgentSessionSwitchFields as isForkRecordFields } from '../../conversation-context/agent-session-agent-switch'
export type ForkRecordFields = AgentSessionSwitchFields & AgentSessionContinuation
