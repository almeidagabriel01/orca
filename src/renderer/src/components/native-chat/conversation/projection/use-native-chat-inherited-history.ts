import { useCallback, useMemo, useState } from 'react'
import { AGENT_SESSION_FORKED_FROM_PRESENTATION } from '../../../../../../shared/agent-session/lifecycle/records/agent-session-fork'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import type { NativeChatInheritedHistory } from '../../messages/actions/native-chat-fork-context'

const isForkedFromRule = (message: NativeChatMessage): boolean =>
  message.blocks.some(
    (block) =>
      block.type === 'text' &&
      block.presentation === AGENT_SESSION_FORKED_FROM_PRESENTATION &&
      block.forkedFrom !== undefined
  )

export type NativeChatInheritedHistoryView = {
  messages: NativeChatMessage[]
  inherited: NativeChatInheritedHistory | null
  /** The inherited rows are held back, so the list must not page them in. */
  folded: boolean
}

/** A side chat's rows without the history it inherited, until the reader unfolds it (per mounted
 *  chat, in memory). Rows are held back by not drawing them, so the virtual list never sees them. */
export function useNativeChatInheritedHistory(
  messages: NativeChatMessage[],
  sideChat: boolean,
  hasMoreHistory: boolean
): NativeChatInheritedHistoryView {
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((open) => !open), [])
  const ruleIndex = useMemo(
    () => (sideChat ? messages.findIndex(isForkedFromRule) : -1),
    [messages, sideChat]
  )
  const folded = ruleIndex > 0 && !expanded
  const shown = useMemo(
    () => (folded ? messages.slice(ruleIndex) : messages),
    [folded, messages, ruleIndex]
  )
  const count = !hasMoreHistory ? ruleIndex : null
  const inherited = useMemo(
    () => (ruleIndex > 0 ? { count, expanded, toggle } : null),
    [count, expanded, ruleIndex, toggle]
  )
  return { messages: shown, inherited, folded }
}
