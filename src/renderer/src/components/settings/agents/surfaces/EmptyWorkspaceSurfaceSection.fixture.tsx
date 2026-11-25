import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import type {
  EmptyWorkspaceAgentSurface,
  EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { EmptyWorkspaceSurfaceView } from './EmptyWorkspaceSurfaceSection'

function Section({
  surface,
  agentSurface
}: {
  surface?: EmptyWorkspaceSurface
  agentSurface?: EmptyWorkspaceAgentSurface
}): React.JSX.Element {
  const settings = getDefaultSettings('/home/fixture')
  return (
    <EmptyWorkspaceSurfaceView
      settings={{
        ...settings,
        ...(surface ? { emptyWorkspaceSurface: surface } : {}),
        ...(agentSurface ? { emptyWorkspaceAgentSurface: agentSurface } : {})
      }}
      updateSettings={() => {}}
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
      <Section surface="default-agent" />
    </div>
  )
})

/** The menu: the + menu's items, the default agent, and nothing; no per-agent list. */
export const open = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[320px] bg-background p-4">
      <Section surface="default-agent" />
    </div>
  ),
  interact: openMenu
})

export const openMenuItemChosen = defineFixture({
  width: 760,
  render: () => (
    <div className="min-h-[320px] bg-background p-4">
      <Section surface="new-browser" />
    </div>
  ),
  interact: openMenu
})

/** A host saved before this change (`agent:claude`) reads as the default agent. */
export const legacyAgentReadsAsDefault = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="agent:claude" agentSurface="chat" />
    </div>
  )
})

/** The default agent shows Open as right under it, saved with the choice. */
export const agentOpensAsChat = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="default-agent" agentSurface="chat" />
    </div>
  )
})

export const agentOpensAsTerminal = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="default-agent" agentSurface="terminal" />
    </div>
  )
})

/** A + menu item has no Open as row. */
export const menuItemHasNoOpenAs = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <Section surface="new-browser" />
    </div>
  )
})
