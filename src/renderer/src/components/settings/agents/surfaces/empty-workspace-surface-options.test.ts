import { describe, expect, it } from 'vitest'
import { buildTabCreateMenuOptions } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import {
  emptyWorkspaceAgentMissing,
  emptyWorkspaceSurfaceOptions
} from './empty-workspace-surface-options'

describe('emptyWorkspaceSurfaceOptions', () => {
  const menu = buildTabCreateMenuOptions({
    hasNewBrowser: true,
    hasNewMarkdown: true,
    hasOpenMarkdown: true,
    hasSimulator: true,
    simulatorIsGoTo: false,
    terminalOnly: false
  })
  const options = emptyWorkspaceSurfaceOptions(
    menu,
    [
      { kind: 'chat', agent: 'claude' },
      { kind: 'cli', agent: 'claude' },
      { kind: 'cli', agent: 'codex' },
      { kind: 'chat', agent: 'grok', setup: true },
      { kind: 'chat-unavailable', agent: 'pi', reason: 'not-installed' }
    ],
    (agent) => agent
  )

  it("offers the + menu's items, then each agent the host runs once", () => {
    expect(options.map((option) => option.value)).toEqual([
      'new-terminal',
      'new-browser',
      'new-markdown',
      'new-simulator',
      'agent:claude',
      'agent:codex'
    ])
  })

  it('flags a saved agent the host no longer runs, once agents have loaded', () => {
    expect(emptyWorkspaceAgentMissing('agent:grok', options, true)).toBe(true)
    expect(emptyWorkspaceAgentMissing('agent:grok', options, false)).toBe(false)
    expect(emptyWorkspaceAgentMissing('agent:codex', options, true)).toBe(false)
  })
})
