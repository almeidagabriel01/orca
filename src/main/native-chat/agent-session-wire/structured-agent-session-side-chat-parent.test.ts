import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../shared/agent-session/journal/agent-session-journal-types'
import {
  sideChatParentBlock,
  sideChatParentDelta
} from './structured-agent-session-side-chat-parent'

const E = 'epoch-1'
const at = (sequence: number) => ({ epoch: E, sequence })

function message(
  itemId: string,
  sequence: number,
  role: 'user' | 'assistant',
  text: string,
  turn?: string
): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence,
    observedAt: 0,
    body: { kind: 'message', role, blocks: [{ type: 'text', text }] },
    ...(turn ? { turnScope: { kind: 'turn' as const, turnItemId: turn } } : {})
  }
}

function turn(itemId: string, sequence: number, state: 'running' | 'completed') {
  return {
    itemId,
    revision: 1,
    sequence,
    observedAt: 0,
    body: { kind: 'turn', turnId: itemId, state }
  } satisfies AgentJournalRenderItem
}

describe('sideChatParentDelta', () => {
  it('holds a running turn and delivers only its final response, once, after it ends', () => {
    const running = sideChatParentDelta(
      [
        message('u1', 11, 'user', 'first ask'),
        turn('t1', 12, 'running'),
        message('a1', 13, 'assistant', 'looking', 't1')
      ],
      at(10),
      at(13)
    )
    expect(running.messages).toEqual([{ role: 'user', text: 'first ask' }])
    expect(running.through).toEqual(at(11))

    // The turn ended: its row and final answer were rewritten above the held cursor.
    const ended = sideChatParentDelta(
      [
        message('a1', 13, 'assistant', 'looking', 't1'),
        message('a2', 15, 'assistant', 'done: it works', 't1'),
        turn('t1', 16, 'completed')
      ],
      running.through,
      at(16)
    )
    expect(ended.messages).toEqual([{ role: 'assistant', text: 'done: it works' }])
    expect(ended.through).toEqual(at(16))

    expect(sideChatParentDelta([], ended.through, at(16)).messages).toEqual([])
  })

  it('keeps the newest 12 messages within 9000 chars, says so, and moves past the rest', () => {
    const items = Array.from({ length: 15 }, (_, i) => message(`u${i}`, i + 1, 'user', `m${i}`))
    const capped = sideChatParentDelta(items, at(0), at(15))
    expect(capped.messages.map((m) => m.text)).toEqual(
      Array.from({ length: 12 }, (_, i) => `m${i + 3}`)
    )
    expect(capped.omitted).toBe(3)
    expect(capped.through).toEqual(at(15))
    expect(sideChatParentBlock(capped)).toContain('[3 earlier parent messages omitted]')

    const long = sideChatParentDelta(
      [message('old', 1, 'user', 'x'.repeat(5000)), message('new', 2, 'user', 'y'.repeat(5000))],
      at(0),
      at(2)
    )
    expect(long.messages.map((m) => m.text.length)).toEqual([4000 + '… [truncated]'.length, 5000])
  })

  it('re-anchors on a new parent epoch without comparing sequences', () => {
    const delta = sideChatParentDelta(
      [message('u1', 3, 'user', 'after rewind')],
      { epoch: 'old', sequence: 1 },
      at(3)
    )
    expect(delta.messages).toEqual([])
    expect(delta.through).toEqual(at(3))
  })
})
