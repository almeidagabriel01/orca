import { describe, expect, it } from 'vitest'
import { decideWorkerStartMode } from './orchestration-worker-start-mode'

// A host whose new agent tabs open the CLI, as a headless server's do by default.
const terminalDefault = { agentDefaultSurface: 'terminal' as const }

describe('how a worker starts', () => {
  it('honors --surface over the settings and over a chat lineage', () => {
    const start = (
      params: Parameters<typeof decideWorkerStartMode>[0]['params'],
      chatLineage = true
    ) => decideWorkerStartMode({ params, settings: terminalDefault, chatLineage }).mode
    expect(start({ agent: 'claude', surface: 'terminal' })).toBe('terminal')
    expect(start({ agent: 'claude', surface: 'chat' }, false)).toBe('structured')
    // A paired server's worker is a terminal; asking for a chat there is refused.
    expect(() => start({ agent: 'claude', on: 'vps', surface: 'chat' })).toThrow()
  })
})
