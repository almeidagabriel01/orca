import { describe, expect, it } from 'vitest'
import { collapseUnreadyAgentPickerEntries } from './agent-launch-picker-ready'
import type { NewTabAgentMenuRow } from './agent-launch-picker-rows'

const entry = (id: string, rows: NewTabAgentMenuRow[]) => ({ id, rows })
const entries = [
  entry('claude', [{ kind: 'chat', agent: 'claude' }]),
  entry('codex', [{ kind: 'cli', agent: 'codex' }]),
  entry('grok', [{ kind: 'chat', agent: 'grok', setup: true }]),
  entry('pi', [{ kind: 'chat-unavailable', agent: 'pi', reason: 'not-installed' }])
]
const ids = (list: { id: string }[]): string[] => list.map((e) => e.id)

describe('collapseUnreadyAgentPickerEntries', () => {
  it('keeps runnable agents and counts the ones that need installing', () => {
    const { shown, hiddenCount } = collapseUnreadyAgentPickerEntries(entries, '', false)
    expect(ids(shown)).toEqual(['claude', 'codex'])
    expect(hiddenCount).toBe(2)
  })

  it('lists everything when asked, or while searching', () => {
    expect(collapseUnreadyAgentPickerEntries(entries, '', true).hiddenCount).toBe(0)
    expect(ids(collapseUnreadyAgentPickerEntries(entries, 'pi', false).shown)).toHaveLength(4)
  })
})
