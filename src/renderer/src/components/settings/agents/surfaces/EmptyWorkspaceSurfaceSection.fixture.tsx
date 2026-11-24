import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import type { AgentPickerEntry } from '../../../../../../shared/agent-launch/picker/agent-launch-picker'
import type { NewTabAgentMenuRow } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import type { EmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { EmptyWorkspaceSurfaceView } from './EmptyWorkspaceSurfaceSection'

function entry(agent: TuiAgent, label: string, rows: NewTabAgentMenuRow[]): AgentPickerEntry {
  const ready = rows.some((row) => row.kind === 'chat' || row.kind === 'cli')
  return {
    agent,
    label,
    rows,
    surfaces: ready ? ['terminal'] : [],
    defaultSurface: 'terminal',
    terminal: {},
    structured: {},
    catalog: { origin: 'unknown' },
    catalogRead: 'settled'
  }
}

// A host with Claude, Agent Teams and Codex; Grok and OpenCode would need installing.
const ENTRIES: AgentPickerEntry[] = [
  entry('claude', 'Claude', [{ kind: 'chat', agent: 'claude' }]),
  entry('claude-agent-teams', 'Claude Agent Teams', [{ kind: 'cli', agent: 'claude-agent-teams' }]),
  entry('codex', 'Codex', [{ kind: 'cli', agent: 'codex' }]),
  entry('grok', 'Grok', [{ kind: 'chat', agent: 'grok', setup: true }]),
  entry('opencode', 'OpenCode', [
    { kind: 'chat-unavailable', agent: 'opencode', reason: 'not-installed' }
  ])
]

function Section({ surface }: { surface?: EmptyWorkspaceSurface }): React.JSX.Element {
  const settings = getDefaultSettings('/home/fixture')
  return (
    <EmptyWorkspaceSurfaceView
      settings={surface ? { ...settings, emptyWorkspaceSurface: surface } : settings}
      updateSettings={() => {}}
      agentEntries={ENTRIES}
      simulatorAvailable
    />
  )
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150))
async function openMenu(frame: HTMLElement): Promise<void> {
  const trigger = frame.querySelector<HTMLElement>('[data-slot="dropdown-menu-trigger"]')
  trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  await settle()
}

export const closed = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="agent:claude" />
    </div>
  )
})

export const open = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[460px] bg-background p-4">
      <Section surface="agent:claude" />
    </div>
  ),
  interact: openMenu
})

export const openMenuItemChosen = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[460px] bg-background p-4">
      <Section surface="new-browser" />
    </div>
  ),
  interact: openMenu
})

export const showAllAgents = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[520px] bg-background p-4">
      <Section surface="nothing" />
    </div>
  ),
  interact: async (frame) => {
    await openMenu(frame)
    ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.includes('Show all agents'))
      ?.click()
    await settle()
  }
})

/** A chosen agent the host no longer runs: the row says a terminal opens instead. */
export const agentMissing = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="agent:gemini" />
    </div>
  )
})
