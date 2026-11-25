import { expect, it } from 'vitest'
import { parseClaudeSessionContent } from './session-scanner-primary-parsers'

const file = {
  path: '/home/me/.claude/projects/-home-me-app/s1.jsonl',
  mtimeMs: 1,
  modifiedAt: '2026-11-20T00:00:00.000Z'
}

function line(model: string, text: string): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2026-11-20T00:00:00.000Z',
    message: { role: 'assistant', model, content: [{ type: 'text', text }] }
  })
}

const prompt = JSON.stringify({
  type: 'user',
  timestamp: '2026-11-20T00:00:00.000Z',
  message: { role: 'user', content: 'hi' }
})

// Claude Code writes `<synthetic>` on its own notices (limits, interrupts); it names no model.
it.each([
  {
    lines: [prompt, line('claude-opus-4-5', 'a'), line('<synthetic>', 'b')],
    model: 'claude-opus-4-5'
  },
  { lines: [prompt, line('<synthetic>', 'b')], model: null }
])('ignores <synthetic> as the session model (%#)', async ({ lines, model }) => {
  const session = await parseClaudeSessionContent(file, lines.join('\n'), 'linux')
  expect(session?.model).toBe(model)
})
