import { create } from 'zustand'
import type { Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'

/** Anchor key of the side chat panel body; not a group id, so it never collides with one. */
export const SIDE_CHAT_DOCK_ANCHOR_KEY = 'right-panel:side-chat'

export function isDockedChatTab(tab: Tab): boolean {
  return tab.dock === 'right-panel'
}

type SideChatDockState = {
  selectedTabIdByWorktree: Record<string, string>
  /** Focus or the last press sits in the docked chat or its panel, so it owns the keyboard. */
  focused: boolean
  selectTab: (worktreeId: string, tabId: string) => void
  setFocused: (focused: boolean) => void
}

export const useSideChatDockStore = create<SideChatDockState>()((set) => ({
  selectedTabIdByWorktree: {},
  focused: false,
  selectTab: (worktreeId, tabId) =>
    set((s) =>
      s.selectedTabIdByWorktree[worktreeId] === tabId
        ? {}
        : { selectedTabIdByWorktree: { ...s.selectedTabIdByWorktree, [worktreeId]: tabId } }
    ),
  setFocused: (focused) => set((s) => (s.focused === focused ? {} : { focused }))
}))

/** The docked tab the panel shows: the picked one while docked, else the last docked. */
export function resolveSelectedDockedTabId(
  dockedTabs: readonly Tab[],
  selectedTabId: string | undefined
): string | null {
  if (selectedTabId && dockedTabs.some((tab) => tab.id === selectedTabId)) {
    return selectedTabId
  }
  return dockedTabs.at(-1)?.id ?? null
}
