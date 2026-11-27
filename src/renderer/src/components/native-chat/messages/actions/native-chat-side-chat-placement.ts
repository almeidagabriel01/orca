import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { findStructuredLaunchTab } from '@/lib/agent-session/launch/structured-agent-session-launch-surface'
import { afterPendingTab } from '@/runtime/workspace-layout/intents/layout-owner-pending-tabs'
import { requestNativeChatComposerFocus } from '../../composer/focus/native-chat-composer-focus-intent'
import { useSideChatDockStore } from '../../../right-sidebar/side-chat/side-chat-dock-state'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

// Revealing a late side chat would yank the panel the user may already be reading.
const SIDE_CHAT_REVEAL_MS = 5_000
const SIDE_CHAT_WATCH_MS = 60_000

type SideChat = { sessionId: string; executionHostId: ExecutionHostId }

/** One `/btw` request's claim on the screen, from Send until its side chat is docked. */
export type NativeChatSideChatPlacement = {
  /** The side chat to dock once its tab is drawn; undefined when there is nothing to dock. */
  settle: (chat: SideChat | undefined) => void
}

/** Starts at Send. The side chat is always docked in the right panel; it is shown and focused there
 *  only while the claim holds. Any other selection in the workspace, or leaving it, retires the claim,
 *  and the side chat then docks without taking the screen. */
export function beginNativeChatSideChatPlacement(worktreeId: string): NativeChatSideChatPlacement {
  const initial = useAppStore.getState()
  const before = selectionKey(initial, worktreeId)
  const activeWorktreeId = initial.activeWorktreeId
  let chat: SideChat | undefined
  let settledAt = 0
  let lookingUp = false
  let claimed = true
  let watching = true

  const stopWatching = (): void => {
    if (watching) {
      watching = false
      unsubscribe()
      clearTimeout(expiry)
    }
  }
  const dock = (tabId: string): void => {
    const reveal = claimed && Date.now() - settledAt <= SIDE_CHAT_REVEAL_MS
    stopWatching()
    const state = useAppStore.getState()
    if (!state.unifiedTabsByWorktree[worktreeId]?.some((tab) => tab.id === tabId)) {
      return
    }
    state.setTabDock(tabId, 'right-panel')
    if (reveal) {
      useSideChatDockStore.getState().selectTab(worktreeId, tabId)
      state.setRightSidebarTab('side-chat')
      state.setRightSidebarOpen(true)
      requestNativeChatComposerFocus(tabId)
    }
  }
  const lookUp = (): void => {
    const tab = chat && findStructuredLaunchTab({ worktreeId, ...chat })
    if (tab) {
      lookingUp = false
      // Main may still be drawing it; dock the tab its frame shows.
      afterPendingTab(tab.id, (drawn) => (drawn ? dock(drawn) : stopWatching()))
    }
  }
  const onChange = (state: AppState, previous: AppState): void => {
    if (
      claimed &&
      (state.activeWorktreeId !== activeWorktreeId ||
        !state.groupsByWorktree[worktreeId] ||
        ((state.groupsByWorktree[worktreeId] !== previous.groupsByWorktree[worktreeId] ||
          state.activeGroupIdByWorktree[worktreeId] !==
            previous.activeGroupIdByWorktree[worktreeId]) &&
          selectionKey(state, worktreeId) !== before))
    ) {
      claimed = false
    }
    if (
      lookingUp &&
      state.unifiedTabsByWorktree[worktreeId] !== previous.unifiedTabsByWorktree[worktreeId]
    ) {
      lookUp()
    }
  }
  const unsubscribe = useAppStore.subscribe(onChange)
  let expiry: ReturnType<typeof setTimeout> | undefined
  return {
    settle: (next) => {
      if (!watching || chat || !next) {
        stopWatching()
        return
      }
      chat = next
      settledAt = Date.now()
      expiry = setTimeout(stopWatching, SIDE_CHAT_WATCH_MS)
      lookingUp = true
      lookUp()
    }
  }
}

/** The workspace's active pane and each pane's active tab. */
function selectionKey(
  state: Pick<AppState, 'activeGroupIdByWorktree' | 'groupsByWorktree'>,
  worktreeId: string
): string {
  const tabs = (state.groupsByWorktree[worktreeId] ?? []).map(
    (group) => `${group.id}:${group.activeTabId ?? ''}`
  )
  return `${state.activeGroupIdByWorktree[worktreeId] ?? ''}|${tabs.join(',')}`
}
