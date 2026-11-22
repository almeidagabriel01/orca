import { AGENT_CHAT_HOST_ACCOUNT } from '../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import {
  getStructuredLaunchStateBySessionId,
  notifyStructuredLaunchListeners
} from './structured-agent-session-launch-state-store'

/** Holds a pick for the create still to be sent; false once create has its input. */
export function holdStructuredLaunchAccount(sessionId: string, choice: string): boolean {
  const state = getStructuredLaunchStateBySessionId(sessionId)
  if (!state || state.intent.createPrepared) {
    return false
  }
  if (choice === AGENT_CHAT_HOST_ACCOUNT) {
    delete state.intent.accountChoice
  } else {
    state.intent.accountChoice = choice
  }
  notifyStructuredLaunchListeners(sessionId)
  return true
}
