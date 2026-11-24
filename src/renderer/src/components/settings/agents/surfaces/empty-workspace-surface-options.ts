import type { TabCreateMenuOption } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import {
  agentMenuRowReady,
  type NewTabAgentMenuRow
} from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import {
  EMPTY_WORKSPACE_MENU_SURFACES,
  type EmptyWorkspaceMenuSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'

export type EmptyWorkspaceSurfaceOption =
  | { value: EmptyWorkspaceMenuSurface; kind: 'menu'; label: string }
  | { value: `agent:${TuiAgent}`; kind: 'agent'; agent: TuiAgent; label: string }

/** The + menu's own items an empty workspace can open, then each agent the host runs now. */
export function emptyWorkspaceSurfaceOptions(
  menuOptions: readonly TabCreateMenuOption[],
  agentRows: readonly NewTabAgentMenuRow[],
  agentLabel: (agent: TuiAgent) => string
): EmptyWorkspaceSurfaceOption[] {
  const menu = menuOptions.flatMap((option): EmptyWorkspaceSurfaceOption[] => {
    const value = EMPTY_WORKSPACE_MENU_SURFACES.find((surface) => surface === option.id)
    return value ? [{ value, kind: 'menu', label: option.label }] : []
  })
  const agents = [...new Set(agentRows.filter(agentMenuRowReady).map((row) => row.agent))]
  return [
    ...menu,
    ...agents.map((agent): EmptyWorkspaceSurfaceOption => ({
      value: `agent:${agent}`,
      kind: 'agent',
      agent,
      label: agentLabel(agent)
    }))
  ]
}

/** A saved agent the host no longer runs opens a terminal instead; the setting says so. */
export function emptyWorkspaceAgentMissing(
  value: EmptyWorkspaceSurface,
  options: readonly EmptyWorkspaceSurfaceOption[],
  agentsLoaded: boolean
): boolean {
  return (
    agentsLoaded && value.startsWith('agent:') && !options.some((option) => option.value === value)
  )
}
