import { buildHeadlessTabGroupMove } from '../tab-groups/tab-group-moves'
import { dockedOnlyGroupMoves } from '../tab-groups/tab-dock'
import type { CommandOf } from '../workspace-layout-command-types'
import type { WorkspaceLayout, WorkspaceLayoutModel } from '../workspace-layout-model'
import {
  applied,
  findTab,
  refuse,
  replaceTab,
  type Applied
} from './workspace-layout-command-steps'
import { withWorkspace } from './workspace-layout-removal'

export function setTabDock(model: WorkspaceLayoutModel, command: CommandOf<'setTabDock'>): Applied {
  const workspace = model.workspaces[command.workspace]!
  const tab = findTab(workspace, command.tabId)
  if (!tab) {
    return refuse('tab_not_found')
  }
  const docked = { ...tab }
  if (command.dock) {
    docked.dock = command.dock
  } else {
    delete docked.dock
  }
  let next = replaceTab(workspace, docked)
  if (command.dock === null && command.groupId) {
    next = moveToGroupEnd(next, tab.id, command.groupId)
  }
  return applied(withWorkspace(model, command.workspace, next))
}

/** Docked tabs left alone in a group move to one still showing tabs, so that group closes as an empty one does. */
export function rehomeDockedTabs(workspace: WorkspaceLayout): WorkspaceLayout {
  let next = workspace
  for (const { tabId, toGroupId } of dockedOnlyGroupMoves(workspace.groups, workspace.tabs)) {
    next = moveToGroupEnd(next, tabId, toGroupId)
  }
  return next
}

function moveToGroupEnd(
  workspace: WorkspaceLayout,
  tabId: string,
  groupId: string
): WorkspaceLayout {
  const moved = buildHeadlessTabGroupMove({
    groups: workspace.groups,
    layout: workspace.groupLayout,
    tabId,
    targetGroupId: groupId
  })
  return moved
    ? { ...workspace, groups: moved.groups, groupLayout: moved.layout ?? undefined }
    : workspace
}
