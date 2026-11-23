import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatAgentSwitchMenuView } from './NativeChatAgentSwitchMenu'
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type {
  NativeChatAccountControl,
  NativeChatAgentSwitch
} from '../../session/options/structured/use-structured-chat-account'

function Menu({ agent, busy }: { agent: string; busy: boolean }): React.JSX.Element {
  const agentSwitch: NativeChatAgentSwitch = {
    agent,
    agents: ['claude', 'codex'],
    busy,
    switchTo: async () => {}
  }
  const control: NativeChatAccountControl = {
    target: { kind: 'local' },
    choice: undefined,
    agentSwitch
  }
  return (
    <div className="native-chat-appearance flex h-96 items-end bg-background p-4 text-chat-foreground">
      <NativeChatAgentSwitchMenuView
        control={control}
        agentSwitch={agentSwitch}
        variant="pill"
        accounts={accounts}
      />
    </div>
  )
}

const stamp = { createdAt: 0, updatedAt: 0, lastAuthenticatedAt: 0 }
const accounts: ProviderAccountsSnapshot = {
  claude: {
    accounts: [
      { id: 'work', email: 'work@example.com', authMethod: 'subscription-oauth', ...stamp },
      {
        id: 'personal',
        email: 'personal@example.com',
        displayName: 'Personal',
        authMethod: 'subscription-oauth',
        ...stamp
      }
    ],
    activeAccountId: 'work',
    systemDefaultEmail: 'me@example.com'
  },
  codex: {
    accounts: [{ id: 'codex-main', email: 'dev@example.com', ...stamp }],
    activeAccountId: 'codex-main'
  },
  rateLimits: null
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const openMenu = async (frame: HTMLElement): Promise<void> => {
  frame
    .querySelector('button')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  await wait(50)
}

export const idle = defineFixture({
  width: 420,
  render: () => <Menu agent="claude" busy={false} />,
  interact: openMenu
})

export const codexCurrent = defineFixture({
  width: 420,
  render: () => <Menu agent="codex" busy={false} />,
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
    const rows = document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    ;[...rows].at(-1)?.click()
    await wait(50)
  }
})
