import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { i18n, loadRendererUiLanguage } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'
import type { NativeChatTextBlock } from '../../../../../../shared/native-chat/native-chat-types'
import type { AgentSessionAgentSwitchMark } from '../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'

const agentMark: AgentSessionAgentSwitchMark = {
  kind: 'agent',
  fromAgent: 'claude',
  toAgent: 'codex',
  fromAccountLabel: 'work@example.com',
  toAccountLabel: 'personal@example.com',
  handoff: {
    excerpt:
      'Goal: make the sync retry after reconnect.\n\nDone so far:\n- Found the stalled loop in sync-worker.ts\n- Added a backoff test that fails today\n\nNext: wire the backoff into reconnect() and run the suite.',
    transcriptPath: '/home/user/.orca/agent-sessions/handoffs/3f2a9c/transcript.md'
  }
}

const accountMark: AgentSessionAgentSwitchMark = {
  kind: 'account',
  fromAgent: 'claude',
  toAgent: 'claude',
  fromAccountLabel: 'work@example.com',
  toAccountLabel: 'personal@example.com'
}

function divider(mark: AgentSessionAgentSwitchMark): NativeChatTextBlock {
  return {
    type: 'text',
    text: 'Continued on another agent',
    presentation: 'agent-switch',
    agentSwitch: mark
  }
}

function Surface({ mark }: { mark: AgentSessionAgentSwitchMark }): React.JSX.Element {
  return (
    <div className="native-chat-appearance bg-background p-4 text-chat-foreground">
      <NativeChatNoticeRow block={divider(mark)} />
    </div>
  )
}

const expand = (frame: HTMLElement): void => {
  frame.querySelector<HTMLButtonElement>('button[aria-expanded]')?.click()
}

export const agent = defineFixture({ width: 640, render: () => <Surface mark={agentMark} /> })

export const agentExpanded = defineFixture({
  width: 640,
  render: () => <Surface mark={agentMark} />,
  interact: expand
})

export const account = defineFixture({ width: 640, render: () => <Surface mark={accountMark} /> })

export const accountExpanded = defineFixture({
  width: 640,
  render: () => <Surface mark={accountMark} />,
  interact: expand
})

// Back to the system login, which has no saved row: the host names it by its email too.
const backToSystemMark: AgentSessionAgentSwitchMark = {
  kind: 'account',
  fromAgent: 'claude',
  toAgent: 'claude',
  fromAccountLabel: 'personal@example.com',
  toAccountLabel: 'system-login@example.com'
}

export const accountRoundTripPtBr = defineFixture({
  width: 640,
  render: () => (
    <>
      <Surface mark={accountMark} />
      <Surface mark={backToSystemMark} />
    </>
  ),
  setup: () => {
    useAppStore.setState((app) => ({
      settings: app.settings && { ...app.settings, uiLanguage: 'pt' }
    }))
  },
  interact: async () => {
    await i18n.changeLanguage(await loadRendererUiLanguage('pt'))
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
})
