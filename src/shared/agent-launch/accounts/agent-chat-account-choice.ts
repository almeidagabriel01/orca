/** The option key a chat's own account rides on, in create options and setOption. Never rename. */
export const AGENT_CHAT_ACCOUNT_OPTION_ID = 'agentAccount'

/** The chat runs on the host's System default login, whatever account the host selects. */
export const AGENT_CHAT_SYSTEM_ACCOUNT = 'system'

/** Picked to clear a chat's choice: its launches follow the host's selection again. */
export const AGENT_CHAT_HOST_ACCOUNT = 'host'

const ACCOUNT_ID = /^[a-zA-Z0-9_-]{1,512}$/

/** A saved choice: System default or a saved account's id. `host` is never saved; it clears. */
export function isAgentChatAccountChoice(value: unknown): value is string {
  return typeof value === 'string' && value !== AGENT_CHAT_HOST_ACCOUNT && ACCOUNT_ID.test(value)
}

/** What a client may send: a choice, or `host` to clear one. */
export function isAgentChatAccountPick(value: unknown): value is string {
  return value === AGENT_CHAT_HOST_ACCOUNT || isAgentChatAccountChoice(value)
}

/** Agents whose chats can run on an account of their own; others follow the host's selection. */
export function agentSupportsChatAccountChoice(agent: string): boolean {
  return agent === 'claude'
}
