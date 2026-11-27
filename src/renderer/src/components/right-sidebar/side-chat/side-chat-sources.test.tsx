// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { NativeChatSideChat } from '../../native-chat/messages/actions/use-native-chat-side-chat'
import { usePublishSideChatSource, useSideChatSourceStore } from './side-chat-sources'

const surface = (): NativeChatSideChat => ({
  notReadyReason: null,
  finishedForkItemId: 'item',
  open: async () => ({ started: true }),
  reportForkPoint: () => {}
})

it('a pane that unmounts never drops the surface a newer pane of the same tab published', () => {
  const first = surface()
  const second = surface()
  const old = renderHook(() => usePublishSideChatSource('tab', first))
  const next = renderHook(() => usePublishSideChatSource('tab', second))
  old.unmount()
  expect(useSideChatSourceStore.getState().byTabId.tab).toBe(second)
  next.unmount()
  expect(useSideChatSourceStore.getState().byTabId.tab).toBeUndefined()
})
