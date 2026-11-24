import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import type { NewTabAgentMenuRow } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import type { EmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { EmptyWorkspaceSurfaceView } from './EmptyWorkspaceSurfaceSection'

// The + menu's rows on a host with Claude, Agent Teams and Codex; Grok would need installing.
const ROWS: NewTabAgentMenuRow[] = [
  { kind: 'chat', agent: 'claude' },
  { kind: 'cli', agent: 'claude-agent-teams' },
  { kind: 'chat', agent: 'codex' },
  { kind: 'cli', agent: 'codex' },
  { kind: 'chat', agent: 'grok', setup: true }
]

function Section({ surface }: { surface?: EmptyWorkspaceSurface }): React.JSX.Element {
  const settings = getDefaultSettings('/home/fixture')
  return (
    <EmptyWorkspaceSurfaceView
      settings={surface ? { ...settings, emptyWorkspaceSurface: surface } : settings}
      updateSettings={() => {}}
      agentRows={ROWS}
      simulatorAvailable
    />
  )
}

export const unset = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section />
    </div>
  )
})

export const open = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[420px] bg-background p-4">
      <Section surface="agent:claude" />
    </div>
  ),
  interact: async (frame) => {
    const trigger = frame.querySelector<HTMLElement>('[data-slot="select-trigger"]')
    trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    trigger?.click()
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
})

/** A chosen agent the host no longer runs: the row says a terminal opens instead. */
export const agentMissing = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="agent:grok" />
    </div>
  )
})
