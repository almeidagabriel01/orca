import { describe, expect, it } from 'vitest'
import { buildTabCreateMenuOptions } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import {
  emptyWorkspaceAgentMissing,
  emptyWorkspaceSurfaceOptions
} from './empty-workspace-surface-options'
import type { AgentPickerEntry } from '../../../../../../shared/agent-launch/picker/agent-launch-picker'
import type { NewTabAgentMenuRow } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'

describe('emptyWorkspaceSurfaceOptions', () => {
  const menu = buildTabCreateMenuOptions({
    hasNewBrowser: true,
    hasNewMarkdown: true,
    hasOpenMarkdown: true,
    hasSimulator: true,
    simulatorIsGoTo: false,
    terminalOnly: false
  })
  const entry = (agent: TuiAgent, rows: NewTabAgentMenuRow[]) =>
    ({ agent, label: agent, rows }) as unknown as AgentPickerEntry
  const options = emptyWorkspaceSurfaceOptions(menu, [
    entry('claude', [
      { kind: 'chat', agent: 'claude' },
      { kind: 'cli', agent: 'claude' }
    ]),
    entry('codex', [{ kind: 'cli', agent: 'codex' }]),
    entry('grok', [{ kind: 'chat', agent: 'grok', setup: true }]),
    entry('pi', [{ kind: 'chat-unavailable', agent: 'pi', reason: 'not-installed' }])
  ])

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
