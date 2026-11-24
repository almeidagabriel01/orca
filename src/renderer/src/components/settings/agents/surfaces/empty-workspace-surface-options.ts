import type { TabCreateMenuOption } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import type { AgentPickerEntry } from '../../../../../../shared/agent-launch/picker/agent-launch-picker'
import { agentPickerEntryReady } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-ready'
import {
  EMPTY_WORKSPACE_MENU_SURFACES,
  type EmptyWorkspaceMenuSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'

export type EmptyWorkspaceSurfaceOption =
  | { value: EmptyWorkspaceMenuSurface; kind: 'menu'; label: string }
  | {
      value: `agent:${TuiAgent}`
      kind: 'agent'
      agent: TuiAgent
      label: string
    }

/** The + menu's own items an empty workspace can open, then each agent the host runs now. */
export function emptyWorkspaceSurfaceOptions(
  menuOptions: readonly TabCreateMenuOption[],
  agentEntries: readonly AgentPickerEntry[]
): EmptyWorkspaceSurfaceOption[] {
  const menu = menuOptions.flatMap((option): EmptyWorkspaceSurfaceOption[] => {
    const value = EMPTY_WORKSPACE_MENU_SURFACES.find((surface) => surface === option.id)
    return value ? [{ value, kind: 'menu', label: option.label }] : []
  })
  return [
    ...menu,
    ...agentEntries.filter(agentPickerEntryReady).map((entry): EmptyWorkspaceSurfaceOption => ({
      value: `agent:${entry.agent}`,
      kind: 'agent',
      agent: entry.agent,
      label: entry.label
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
