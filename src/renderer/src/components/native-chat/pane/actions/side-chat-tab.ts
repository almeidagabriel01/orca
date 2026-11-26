import { useCallback, useMemo } from 'react'
import type { Tab } from '../../../../../../shared/workspace-layout/tab-groups/tab-types'
import { useAppStateValue, useAppViewExternalStore } from '@/store/retained-views/app-state-view'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import { isNativeChatSideChat } from '@/runtime/native-chat/naming/native-chat-side-chat-marker'

const noSubscription = (): (() => void) => () => {}

/** Whether the tab shows a side chat, from the naming feed of the host recorded on the tab. */
export function useIsSideChatTab(
  tab: Pick<Tab, 'entityId' | 'worktreeId' | 'executionHostId'> | undefined
): boolean {
  const owner = useAppStateValue((state) =>
    tab ? structuredAgentSessionOwnerForTab(state, tab) : null
  )
  const feed = useMemo(() => {
    const target = structuredAgentSessionTargetForHost(owner)
    return target ? getStructuredAgentSessionStatusFeed(target) : null
  }, [owner])
  const sessionId = tab?.entityId
  const subscribe = useCallback(
    (listener: () => void) =>
      feed && sessionId ? feed.subscribeSession(sessionId, listener) : noSubscription(),
    [feed, sessionId]
  )
  return useAppViewExternalStore(
    subscribe,
    () =>
      Boolean(feed && sessionId && isNativeChatSideChat(feed.getNamingSnapshot().get(sessionId))),
    () => false
  )
}
