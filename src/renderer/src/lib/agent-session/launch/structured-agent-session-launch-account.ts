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
  // `host` is sent too: it beats the project account the host would otherwise seed.
  state.intent.accountChoice = choice
  notifyStructuredLaunchListeners(sessionId)
  return true
}
