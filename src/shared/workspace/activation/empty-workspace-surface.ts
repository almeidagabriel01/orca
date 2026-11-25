import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'
import { isTuiAgent } from '../../agent-launch/catalog/tui-agent-config'

/** The + menu items a workspace with no tabs can open by itself (TabCreateMenuOption ids). */
export const EMPTY_WORKSPACE_MENU_SURFACES = [
  'new-terminal',
  'new-browser',
  'new-markdown',
  'new-simulator'
] as const
export type EmptyWorkspaceMenuSurface = (typeof EMPTY_WORKSPACE_MENU_SURFACES)[number]

/**
 * What opening a workspace with no tabs shows: a + menu item, the default agent, or nothing.
 * `agent:<id>` is the older spelling of 'default-agent'; its id no longer picks the agent.
 */
export type EmptyWorkspaceSurface =
  | EmptyWorkspaceMenuSurface
  | 'default-agent'
  | `agent:${TuiAgent}`
  | 'nothing'

/** How a chosen agent opens in an empty workspace. */
export type EmptyWorkspaceAgentSurface = 'chat' | 'terminal'

export type EmptyWorkspaceSurfaceSettings = {
  /** Absent keeps the original rule: the saved default agent's chat when there is one, else a shell. */
  emptyWorkspaceSurface?: EmptyWorkspaceSurface
  /** Absent follows Open agents as for that agent. */
  emptyWorkspaceAgentSurface?: EmptyWorkspaceAgentSurface
}

export function normalizeEmptyWorkspaceAgentSurface(
  value: unknown
): EmptyWorkspaceAgentSurface | undefined {
  return value === 'chat' || value === 'terminal' ? value : undefined
}

export function normalizeEmptyWorkspaceSurface(value: unknown): EmptyWorkspaceSurface | undefined {
  if (value === 'nothing' || value === 'default-agent') {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const menu = EMPTY_WORKSPACE_MENU_SURFACES.find((surface) => surface === value)
  if (menu) {
    return menu
  }
  const agent = value.startsWith('agent:') ? value.slice('agent:'.length) : null
  return agent !== null && isTuiAgent(agent) ? `agent:${agent}` : undefined
}

/** Whether an empty workspace opens an agent; which one is the project's default, else the global one. */
export function emptyWorkspaceSurfaceOpensAgent(
  surface: EmptyWorkspaceSurface | undefined
): boolean {
  return surface === 'default-agent' || surface?.startsWith('agent:') === true
}

/** Launch fields for the chosen agent: Chat asks for the chat route (the host may still decline it), Terminal forces one. */
export function emptyWorkspaceAgentLaunchSurface(
  surface: EmptyWorkspaceAgentSurface | undefined
): { preferredSurface: 'chat' } | { requestedSurface: 'terminal' } | Record<string, never> {
  return surface === 'chat'
    ? { preferredSurface: 'chat' }
    : surface === 'terminal'
      ? { requestedSurface: 'terminal' }
      : {}
}

/** Whether a host's choice opens something other than its usual first shell, so it seeds none. */
export function emptyWorkspaceSkipsHostShell(settings: EmptyWorkspaceSurfaceSettings): boolean {
  const surface = normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface)
  return surface !== undefined && surface !== 'new-terminal'
}
