/** Replaces the provider options, sets the permission mode or sets the chat's account (null
 *  clears it), one at a time, so no write touches another. */
export type AgentSessionOptionsReplacement = {
  sessionId: string
  fence: number
  now: number
} & (
  | { options: Readonly<Record<string, string>> }
  | { permissionMode: string }
  | { accountChoice: string | null }
)
