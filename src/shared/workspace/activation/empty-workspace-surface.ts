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

export type EmptyWorkspaceSurfaceSettings = {
  /** Absent keeps the original rule: the saved default agent's chat when there is one, else a shell. */
  emptyWorkspaceSurface?: EmptyWorkspaceSurface
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
