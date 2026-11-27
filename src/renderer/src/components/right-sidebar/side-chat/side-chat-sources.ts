import { useEffect } from 'react'
import { create } from 'zustand'
import type { NativeChatSideChat } from '../../native-chat/messages/actions/use-native-chat-side-chat'

/** Each mounted chat pane's `/btw` surface, so the side chat panel can start one from the focused chat. */
export const useSideChatSourceStore = create<{ byTabId: Record<string, NativeChatSideChat> }>()(
  () => ({ byTabId: {} })
)

export function usePublishSideChatSource(
  tabId: string,
  sideChat: NativeChatSideChat | undefined
): void {
  useEffect(() => {
    if (!sideChat) {
      return
    }
    useSideChatSourceStore.setState((s) => ({ byTabId: { ...s.byTabId, [tabId]: sideChat } }))
    return () =>
      useSideChatSourceStore.setState((s) => {
        if (s.byTabId[tabId] !== sideChat) {
          return s
        }
        const byTabId = { ...s.byTabId }
        delete byTabId[tabId]
        return { byTabId }
      })
  }, [tabId, sideChat])
}
