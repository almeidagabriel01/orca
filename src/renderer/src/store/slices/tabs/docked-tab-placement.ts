import type { StoreApi } from 'zustand'
import type { AppState } from '../../types'
import type { TabsSlice, TabsSliceGet, TabsSliceSet } from './tabs-slice-contract'
import type { Tab, TabGroup } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { dockedOnlyGroupMoves } from '../../../../../shared/workspace-layout/tab-groups/tab-dock'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../shared/workspace-layout/layout-owner-switch'
import { sendTabChangeToLayoutOwner } from '../../terminals/tabs/presentation/tab-change-through-layout-owner'
import { findTabAndWorktree, patchTab } from './tab-group-state'
import { mirrorTabDockToHost } from './tabs-host-mirroring'
import { pickNextActiveTab } from './tab-selection-history'
import { buildActiveSurfacePatch } from './tabs-surface'
import { ownsGlobalSelection } from '../../workspaces/selection/global-selection-owner'
import { replaceRecordEntries } from '../../record-transitions/keyed-record-transitions'

export function createTabsDockActions(
  set: TabsSliceSet,
  get: TabsSliceGet
): Pick<TabsSlice, 'setTabDock'> {
  const undockInto = (tabId: string): void => {
    const state = get()
    const found = findTabAndWorktree(state.unifiedTabsByWorktree, tabId)
    const groupId = found && state.activeGroupIdByWorktree[found.worktreeId]
    if (groupId) {
      get().moveUnifiedTabToGroup(tabId, groupId, { activate: true, recordInteraction: false })
    }
    get().activateTab(tabId)
  }
  return {
    setTabDock: (tabId, dock) => {
      const state = get()
      const tab = findTabAndWorktree(state.unifiedTabsByWorktree, tabId)?.tab
      if (!tab || (tab.dock ?? null) === dock) {
        return
      }
      const local = (): void => {
        set(
          (current) =>
            patchTab(current.unifiedTabsByWorktree, tabId, { dock: dock ?? undefined }) ?? current
        )
        mirrorTabDockToHost(get(), tabId, dock)
        if (dock === null) {
          undockInto(tabId)
        }
      }
      const groupId = state.activeGroupIdByWorktree[tab.worktreeId]
      // Switch point: main docks its copy and its frame draws it; the window then selects.
      if (
        !ORCA_LAYOUT_OWNER_IS_MAIN ||
        !sendTabChangeToLayoutOwner(
          state,
          tab,
          (id) => ({
            type: 'setTabDock',
            tabId: id,
            dock,
            ...(dock === null && groupId ? { groupId } : {})
          }),
          local,
          {
            shown: () => {
              if (dock === null) {
                get().activateTab(tabId)
              }
            }
          }
        )
      ) {
        local()
      }
    }
  }
}

/** After any change: a group never shows a docked tab, and one left holding only docked tabs hands them on and closes. */
export function followDockedTabs(api: StoreApi<AppState>): void {
  api.subscribe((state, previous) => {
    if (
      state.groupsByWorktree === previous.groupsByWorktree &&
      state.unifiedTabsByWorktree === previous.unifiedTabsByWorktree
    ) {
      return
    }
    for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
      const groups = state.groupsByWorktree[worktreeId]
      if (
        !groups ||
        (tabs === previous.unifiedTabsByWorktree[worktreeId] &&
          groups === previous.groupsByWorktree[worktreeId]) ||
        !tabs.some((tab) => tab.dock)
      ) {
        continue
      }
      if (deselectDockedTabs(api, worktreeId, groups, tabs)) {
        return
      }
      const [move] = dockedOnlyGroupMoves(groups, tabs)
      if (move) {
        // Each move re-enters this listener, which hands on the next one.
        api
          .getState()
          .moveUnifiedTabToGroup(move.tabId, move.toGroupId, { recordInteraction: false })
        return
      }
    }
  })
}

function deselectDockedTabs(
  api: StoreApi<AppState>,
  worktreeId: string,
  groups: readonly TabGroup[],
  tabs: readonly Tab[]
): boolean {
  const docked = new Set(tabs.filter((tab) => tab.dock).map((tab) => tab.id))
  if (!groups.some((group) => group.activeTabId && docked.has(group.activeTabId))) {
    return false
  }
  api.setState((current) => {
    const nextGroups = (current.groupsByWorktree[worktreeId] ?? []).map((group) =>
      group.activeTabId && docked.has(group.activeTabId)
        ? {
            ...group,
            activeTabId: pickNextActiveTab(
              group.tabOrder,
              group.recentTabIds,
              group.activeTabId,
              tabs
            )
          }
        : group
    )
    const groupsByWorktree = replaceRecordEntries(current.groupsByWorktree, [
      [worktreeId, nextGroups]
    ])
    return {
      groupsByWorktree,
      ...(ownsGlobalSelection(current, worktreeId)
        ? buildActiveSurfacePatch(
            { ...current, groupsByWorktree },
            worktreeId,
            current.activeGroupIdByWorktree[worktreeId] ?? null
          )
        : {})
    }
  })
  return true
}
