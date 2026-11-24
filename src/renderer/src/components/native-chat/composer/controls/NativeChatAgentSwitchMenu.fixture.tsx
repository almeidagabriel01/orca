import { useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { i18n, loadRendererUiLanguage } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  fixtureAccountUsage,
  fixtureProviderAccounts
} from '../../../../component-fixtures/fixture-provider-accounts'
import { NativeChatAgentSwitchMenuView } from './NativeChatAgentSwitchMenu'
import type {
  NativeChatAccountControl,
  NativeChatAgentSwitch
} from '../../session/options/structured/use-structured-chat-account'

type MenuState = {
  /** The host's roster and readings haven't loaded. */
  loading?: boolean
  agent: string
  busy?: boolean
  choice?: string
  /** Minutes until Orca's automatic continue, when one is scheduled. */
  autoIn?: number
  agents?: string[]
  installed?: (agent: string) => boolean | null
}

const BUILT_IN_AGENTS = ['claude', 'codex']

function Menu({
  loading = false,
  agent,
  busy = false,
  choice,
  autoIn,
  agents = BUILT_IN_AGENTS,
  installed
}: MenuState): React.JSX.Element {
  const [now] = useState(Date.now)
  const agentSwitch: NativeChatAgentSwitch = {
    agent,
    agents,
    busy,
    switchTo: async () => {}
  }
  const control: NativeChatAccountControl = { target: { kind: 'local' }, choice, agentSwitch }
  return (
    <div className="native-chat-appearance flex h-104 items-end bg-background p-4 text-chat-foreground">
      <NativeChatAgentSwitchMenuView
        control={control}
        agentSwitch={agentSwitch}
        variant="pill"
        accounts={loading ? null : fixtureProviderAccounts}
        usage={loading ? null : fixtureAccountUsage(now)}
        autoContinueAt={autoIn === undefined ? null : now + autoIn * 60_000}
        installed={installed}
      />
    </div>
  )
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const openMenu = async (frame: HTMLElement): Promise<void> => {
  frame
    .querySelector('button')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  await wait(50)
}

/** Follows the host (Work): the rule is marked and Work says it is in use. */
export const idle = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" />,
  interact: openMenu
})

export const pinnedPersonal = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" choice="personal" />,
  interact: openMenu
})

export const accountsLoading = defineFixture({
  width: 420,
  render: () => <Menu loading agent="claude" />,
  interact: openMenu
})

export const codexCurrent = defineFixture({
  width: 420,
  render: () => <Menu agent="codex" />,
  interact: openMenu
})

export const autoContinueScheduled = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" choice="work" autoIn={134.5} />,
  interact: openMenu
})

export const busy = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" busy />,
  interact: openMenu
})

export const busyConfirm = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" busy />,
  interact: async (frame) => {
    await openMenu(frame)
    const rows = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"][aria-checked="false"]:not([data-disabled])'
    )
    ;[...rows].find((row) => row.textContent?.includes('Personal'))?.click()
    await wait(50)
  }
})

// Rendered in pt-BR, so its times read on a 24-hour clock.
export const autoContinueScheduledPtBr = defineFixture({
  width: 420,
  setup: () => {
    useAppStore.setState((app) => ({
      settings: app.settings && { ...app.settings, uiLanguage: 'pt' }
    }))
  },
  render: () => <Menu agent="claude" choice="work" autoIn={134.5} />,
  interact: async (frame) => {
    await i18n.changeLanguage(await loadRendererUiLanguage('pt'))
    await wait(50)
    await openMenu(frame)
  }
})

// A host that registered every chat agent but has only Claude and Codex installed.
const MANY_AGENTS = [
  'claude',
  'codex',
  'pi',
  'grok',
  'opencode',
  'opencode2',
  'omp',
  'antigravity',
  'copilot',
  'kimi',
  'cursor'
]
const manyProviders = (
  <Menu agent="claude" agents={MANY_AGENTS} installed={(id) => id === 'claude' || id === 'codex'} />
)

/** Only installed, signed-in providers, then a quiet way to list the rest. */
export const installedOnly = defineFixture({
  width: 420,
  render: () => manyProviders,
  interact: openMenu
})

export const showAllProviders = defineFixture({
  width: 420,
  render: () => manyProviders,
  interact: async (frame) => {
    await openMenu(frame)
    ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.includes('Show all providers'))
      ?.click()
    await wait(50)
  }
})
