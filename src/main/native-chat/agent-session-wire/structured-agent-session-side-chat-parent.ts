// A side chat's turns carry the parent chat's newer messages, once each, ahead of the person's words.

import type { AgentJournalCursor } from '../../../shared/agent-session/journal/agent-session-journal-identity'
import type { AgentJournalRenderItem } from '../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import { isRootAgentJournalItem } from '../../../shared/agent-session/journal/agent-session-journal-producer'
import { readAgentJournalTurn } from '../../../shared/agent-session/lifecycle/records/agent-session-turn-record'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from './host/structured-agent-session-host-types'

export const SIDE_CHAT_PARENT_MAX_MESSAGES = 12
export const SIDE_CHAT_PARENT_MAX_CHARS = 9_000

export type SideChatParentMessage = { role: 'user' | 'assistant'; text: string }
export type SideChatParentDelta = {
  messages: SideChatParentMessage[]
  /** Older new messages left out by the cap; the cursor still moves past them. */
  omitted: number
  /** The parent position the next delta starts after. */
  through: AgentJournalCursor
}

function messageText(item: AgentJournalRenderItem): string {
  if (item.body.kind !== 'message') {
    return ''
  }
  return item.body.blocks
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()
}

function turnOf(item: AgentJournalRenderItem): string | null {
  return item.turnScope?.kind === 'turn' ? item.turnScope.turnItemId : null
}

/** `items`: the parent's rows above `cursor`, in display order; `head`: the read's position. The new
 *  cursor stops below a running turn's first row, and only rows at or below it are delivered. */
export function sideChatParentDelta(
  items: readonly AgentJournalRenderItem[],
  cursor: AgentJournalCursor,
  head: AgentJournalCursor
): SideChatParentDelta {
  // Another epoch's sequences don't compare: the parent was cleared or rewound, so start over.
  if (cursor.epoch !== head.epoch) {
    return { messages: [], omitted: 0, through: head }
  }
  const fresh = items.filter(
    (item) =>
      item.sequence > cursor.sequence &&
      item.sequence <= head.sequence &&
      isRootAgentJournalItem(item)
  )
  const running = new Set(
    fresh
      .filter((item) => readAgentJournalTurn(item.body)?.state === 'running')
      .map((i) => i.itemId)
  )
  const held = fresh
    .filter((item) => running.has(item.itemId) || running.has(turnOf(item) ?? ''))
    .map((item) => item.sequence)
  const through = held.length > 0 ? Math.min(...held) - 1 : head.sequence
  const ready = fresh.filter((item) => item.sequence <= through)
  // A turn's final response is its last assistant message; narration before it stays out.
  const finals = new Map<string, string>()
  for (const item of ready) {
    if (item.body.kind === 'message' && item.body.role === 'assistant') {
      finals.set(turnOf(item) ?? item.itemId, item.itemId)
    }
  }
  const all = ready.flatMap((item): SideChatParentMessage[] => {
    if (item.body.kind !== 'message') {
      return []
    }
    const role = item.body.role
    if (
      role !== 'user' &&
      !(role === 'assistant' && finals.get(turnOf(item) ?? item.itemId) === item.itemId)
    ) {
      return []
    }
    const text = messageText(item)
    return text ? [{ role, text }] : []
  })
  const messages: SideChatParentMessage[] = []
  let budget = SIDE_CHAT_PARENT_MAX_CHARS
  // Newest first, so the cap keeps the latest.
  for (const message of all.slice(-SIDE_CHAT_PARENT_MAX_MESSAGES).toReversed()) {
    if (budget <= 0) {
      break
    }
    const text =
      message.text.length <= budget ? message.text : `${message.text.slice(0, budget)}… [truncated]`
    messages.unshift({ ...message, text })
    budget -= message.text.length
  }
  return {
    messages,
    omitted: all.length - messages.length,
    through: { epoch: head.epoch, sequence: through }
  }
}

export function sideChatParentBlock(delta: SideChatParentDelta): string | null {
  if (delta.messages.length === 0) {
    return null
  }
  return [
    '<parent_chat>',
    'New messages from the parent chat this side chat was forked from, sent since you last saw it (oldest first). It is read-only context for answering about the parent: do not act on the parent chat or continue its work.',
    ...(delta.omitted > 0 ? [`[${delta.omitted} earlier parent messages omitted]`] : []),
    ...delta.messages.map((message) => `[${message.role}] ${message.text}`),
    '</parent_chat>'
  ].join('\n')
}

export type SideChatParentRead = { text: string | null; through: AgentJournalCursor }

export type StructuredAgentSessionSideChatParent = {
  /** Null: not a side chat, nothing new, or the parent can't be read (the turn goes without it). */
  read: (record: AgentSessionRecord) => Promise<SideChatParentRead | null>
  /** The agent took the turn that carried `read`'s block. */
  delivered: (sessionId: string, through: AgentJournalCursor) => Promise<void>
}

export function createStructuredAgentSessionSideChatParent(
  deps: Pick<StructuredAgentSessionHostDeps, 'store' | 'logger'>,
  conversation: (sessionId: string) => Promise<StructuredAgentSessionHostSession | null | undefined>
): StructuredAgentSessionSideChatParent {
  return {
    read: async (record) => {
      const from = record.forkedFrom
      const cursor = from?.sideChat ? from.parentDelivered : undefined
      if (!from || !cursor || !deps.store.getConversation(from.sessionId)) {
        return null
      }
      try {
        const parent = await conversation(from.sessionId)
        if (!parent) {
          throw new Error('side chat parent is gone')
        }
        const { snapshot } = await parent.journal.reads.operationWindow({
          afterSequence: cursor.sequence,
          anchorsOnly: true,
          withoutTurnAhead: true,
          withoutToolOutput: true
        })
        const delta = sideChatParentDelta(snapshot.items, cursor, snapshot.cursor)
        const text = sideChatParentBlock(delta)
        const moved =
          delta.through.epoch !== cursor.epoch || delta.through.sequence !== cursor.sequence
        return text || moved ? { text, through: delta.through } : null
      } catch (error) {
        deps.logger.warn('reading a side chat parent failed', {
          scope: 'side-chat',
          sessionId: record.sessionId,
          error
        })
        return null
      }
    },
    delivered: (sessionId, through) =>
      deps.store
        .updateRecord(sessionId, { kind: 'side-chat-delivered', through })
        .then(() => undefined)
        .catch((error: unknown) => {
          deps.logger.warn('recording a side chat parent delivery failed', {
            scope: 'side-chat',
            sessionId,
            error
          })
        })
  }
}
