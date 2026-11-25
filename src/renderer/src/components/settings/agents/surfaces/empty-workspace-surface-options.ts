import type { TabCreateMenuOption } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import {
  EMPTY_WORKSPACE_MENU_SURFACES,
  type EmptyWorkspaceMenuSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'

export type EmptyWorkspaceSurfaceOption = { value: EmptyWorkspaceMenuSurface; label: string }

/** The + menu's own items an empty workspace can open. */
export function emptyWorkspaceSurfaceOptions(
  menuOptions: readonly TabCreateMenuOption[]
): EmptyWorkspaceSurfaceOption[] {
  return menuOptions.flatMap((option): EmptyWorkspaceSurfaceOption[] => {
    const value = EMPTY_WORKSPACE_MENU_SURFACES.find((surface) => surface === option.id)
    return value ? [{ value, label: option.label }] : []
  })
}
