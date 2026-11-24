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

/** What opening a workspace with no tabs shows: a + menu item, an agent, or nothing. */
export type EmptyWorkspaceSurface = EmptyWorkspaceMenuSurface | `agent:${TuiAgent}` | 'nothing'

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
  if (value === 'nothing') {
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

/** The agent an empty workspace opens, when its surface names one. */
export function emptyWorkspaceSurfaceAgent(
  surface: EmptyWorkspaceSurface | undefined
): TuiAgent | null {
  const agent = surface?.startsWith('agent:') ? surface.slice('agent:'.length) : null
  return agent !== null && isTuiAgent(agent) ? agent : null
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
