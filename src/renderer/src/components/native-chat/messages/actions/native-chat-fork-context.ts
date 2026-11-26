import { createContext } from 'react'
import type { NativeChatForkSurface } from './use-native-chat-fork'
import type { NativeChatSideChatForkPoint } from './native-chat-side-chat-fork-point'

/** The fork the pane's responses offer; absent where the chat cannot fork. */
export const NativeChatForkContext = createContext<NativeChatForkSurface | undefined>(undefined)

/** Opens the chat a "Forked from" divider names; absent where the pane cannot open chats. */
export const NativeChatForkedFromContext = createContext<
  ((sourceSessionId: string) => void) | undefined
>(undefined)

/** Hears the newest response the drawn transcript offers Fork on, for `/btw`; absent without `/btw`. */
export const NativeChatSideChatForkPointContext = createContext<
  ((point: NativeChatSideChatForkPoint) => void) | undefined
>(undefined)

/** The chat is a side chat: its inherited history starts folded behind the "Forked from" rule. */
export const NativeChatSideChatContext = createContext(false)

/** The folded inherited history a "Forked from" rule can unfold; absent when nothing folds. */
export type NativeChatInheritedHistory = {
  /** Rows held back; null while more of the chat's history is still unloaded. */
  count: number | null
  expanded: boolean
  toggle: () => void
}
export const NativeChatInheritedHistoryContext = createContext<NativeChatInheritedHistory | null>(
  null
)
