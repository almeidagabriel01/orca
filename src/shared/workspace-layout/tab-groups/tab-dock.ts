import type { TabDock } from './tab-types'

type DockableTab = { id: string; dock?: TabDock }
type OrderedGroup = { id: string; tabOrder: readonly string[] }

export function isDockedTab(tab: { dock?: TabDock } | undefined): boolean {
  return tab?.dock !== undefined
}

/** Ids a group's center strip shows: its order without docked tabs. */
export function centerTabIds(tabOrder: readonly string[], tabs: readonly DockableTab[]): string[] {
  const docked = new Set(tabs.filter(isDockedTab).map((tab) => tab.id))
  return tabOrder.filter((id) => !docked.has(id))
}

/** Docked tabs of groups showing nothing in the center, and where each goes so its group closes:
 *  the first group still showing a tab, else the first group. Docked tabs never close with their group. */
export function dockedOnlyGroupMoves(
  groups: readonly OrderedGroup[],
  tabs: readonly DockableTab[]
): { tabId: string; toGroupId: string }[] {
  const docked = new Set(tabs.filter(isDockedTab).map((tab) => tab.id))
  const dockedOnly = (group: OrderedGroup) =>
    group.tabOrder.length > 0 && group.tabOrder.every((id) => docked.has(id))
  const target =
    groups.find((group) => !dockedOnly(group) && group.tabOrder.length > 0) ?? groups[0]
  if (!target) {
    return []
  }
  return groups
    .filter((group) => group.id !== target.id && dockedOnly(group))
    .flatMap((group) => group.tabOrder.map((tabId) => ({ tabId, toGroupId: target.id })))
}
