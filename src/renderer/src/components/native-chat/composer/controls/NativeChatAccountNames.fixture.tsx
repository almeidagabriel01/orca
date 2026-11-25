import { defineFixture } from '../../../../component-fixtures/component-fixture'
import {
  namedClaudeAccounts,
  namedCodexAccounts
} from '../../../../component-fixtures/fixture-account-names'
import { NativeChatAgentSwitchMenuView } from './NativeChatAgentSwitchMenu'
import type {
  NativeChatAccountControl,
  NativeChatAgentSwitch
} from '../../session/options/structured/use-structured-chat-account'

const agentSwitch: NativeChatAgentSwitch = {
  agent: 'claude',
  agents: ['claude', 'codex'],
  busy: false,
  switchTo: async () => {}
}
const control: NativeChatAccountControl = {
  target: { kind: 'local' },
  choice: undefined,
  agentSwitch
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** The chat follows the computer's default (ProOps, badged); Beyond is one pick away, Codex runs on Pessoal. */
export const pickerOpen = defineFixture({
  width: 420,
  render: () => (
    <div className="native-chat-appearance flex h-96 items-end bg-background p-4 text-chat-foreground">
      <NativeChatAgentSwitchMenuView
        control={control}
        agentSwitch={agentSwitch}
        variant="pill"
        accounts={{ claude: namedClaudeAccounts, codex: namedCodexAccounts, rateLimits: null }}
        usage={null}
        autoContinueAt={null}
        installed={() => true}
      />
    </div>
  ),
  interact: async (frame) => {
    frame
      .querySelector('button')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    await wait(50)
  }
})
