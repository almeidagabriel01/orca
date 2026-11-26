// Hold window-drawn open/close/move state until main answers, then redraw affected workspaces; earlier frames must not drop new tabs or resurrect closed ones.

import type { WindowLayoutCommand } from '../commands/layout-apply-send'

/** A workspace's held tabs, by tab-bar or entity id; `groupLayout`: the group sizes the window set. */
export type DrawnTabHold = { workspace: string; ids: readonly string[]; groupLayout?: true }

const held = new Map<string, Map<string, number>>()
const redrawListeners = new Set<(workspaces: readonly string[]) => void>()

/** The tree key of a workspace's group sizes, never a tab id. */
const GROUP_LAYOUT = '\0group-layout'

function count(workspace: string, id: string, by: 1 | -1): void {
  const ids = held.get(workspace) ?? new Map<string, number>()
  const next = (ids.get(id) ?? 0) + by
  if (next > 0) {
    ids.set(id, next)
  } else {
    ids.delete(id)
  }
  if (ids.size > 0) {
    held.set(workspace, ids)
  } else {
    held.delete(workspace)
  }
}

function keysOf(hold: DrawnTabHold): string[] {
  return hold.groupLayout ? [...hold.ids, GROUP_LAYOUT] : [...hold.ids]
}

/** Keeps these as drawn until the release, which redraws their workspaces; a second release is a no-op. */
export function holdDrawnTabs(holds: readonly DrawnTabHold[]): () => void {
  for (const hold of holds) {
    for (const id of keysOf(hold)) {
      count(hold.workspace, id, 1)
    }
  }
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    for (const hold of holds) {
      for (const id of keysOf(hold)) {
        count(hold.workspace, id, -1)
      }
    }
    const workspaces = [...new Set(holds.map((hold) => hold.workspace))]
    for (const listener of redrawListeners) {
      listener(workspaces)
    }
  }
}

export function isDrawnTabHeld(workspace: string, id: string): boolean {
  return held.get(workspace)?.has(id) ?? false
}

export function isDrawnGroupLayoutHeld(workspace: string): boolean {
  return isDrawnTabHeld(workspace, GROUP_LAYOUT)
}

export function holdsDrawnTabs(workspace: string): boolean {
  return held.has(workspace)
}

export function onDrawnTabsRedraw(listener: (workspaces: readonly string[]) => void): () => void {
  redrawListeners.add(listener)
  return () => redrawListeners.delete(listener)
}

/** The tabs, by workspace, that a command the window already drew changes. */
export function drawnTabHolds(worktreeId: string, command: WindowLayoutCommand): DrawnTabHold[] {
  switch (command.type) {
    case 'closeTabs':
      return [{ workspace: worktreeId, ids: command.tabIds }]
    case 'splitGroup':
      return [{ workspace: worktreeId, ids: [command.tabId], groupLayout: true }]
    case 'moveTab':
    case 'renameTab':
    case 'setTabProps':
    case 'setTabDock':
    case 'createTerminalTab':
      return [{ workspace: worktreeId, ids: [command.tabId] }]
    case 'setGroupRatios':
      return [{ workspace: worktreeId, ids: [], groupLayout: true }]
    // Pane commands hold their drawn tree; records are not frame-drawn. Editor/browser/chat/simulator opens and page changes send before drawing.
    case 'openBrowserTab':
    case 'openBrowserPage':
    case 'closeBrowserPage':
    case 'replaceTabContent':
    case 'setBrowserTabProfile':
    case 'openAgentSessionTab':
    case 'openSimulatorTab':
    case 'openRoomTab':
    case 'openEditorTab':
    case 'promotePreviewTab':
    case 'moveTabToWorkspace':
    case 'renameEditorFiles':
    case 'splitPane':
    case 'closePane':
    case 'renamePane':
    case 'equalizePanes':
    case 'movePane':
    case 'setPaneRatios':
    case 'setChatPane':
    case 'movePaneToNewTab':
    case 'sleep':
    case 'wake':
    case 'startPane':
    case 'setDefaultTabsApplied':
      return []
  }
}
