/** What opening a workspace with no tabs shows: a shell, the default agent's chat, or nothing. */
export type EmptyWorkspaceSurface = 'terminal' | 'agent-chat' | 'nothing'

export type EmptyWorkspaceSurfaceSettings = {
  /** Absent keeps the original rule: the saved default agent's chat when there is one, else a shell. */
  emptyWorkspaceSurface?: EmptyWorkspaceSurface
}

export function normalizeEmptyWorkspaceSurface(value: unknown): EmptyWorkspaceSurface | undefined {
  return value === 'terminal' || value === 'agent-chat' || value === 'nothing' ? value : undefined
}
