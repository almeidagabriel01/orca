import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import type { NativeChatSideChat } from '../../native-chat/messages/actions/use-native-chat-side-chat'
import SideChatPanel from './SideChatPanel'
import { useSideChatSourceStore } from './side-chat-sources'

const WORKTREE = 'fixture-worktree'

function chatTab(id: string, label: string, docked = false): Tab {
  return {
    id,
    entityId: `session-${id}`,
    groupId: 'group-1',
    worktreeId: WORKTREE,
    contentType: 'agent-session',
    agentSessionAgent: 'claude',
    viewMode: 'chat',
    label,
    customLabel: label,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...(docked ? { dock: 'right-panel' as const } : {})
  }
}

function workspace(tabs: Tab[]): Record<string, unknown> {
  return {
    activeWorktreeId: WORKTREE,
    unifiedTabsByWorktree: { [WORKTREE]: tabs },
    groupsByWorktree: {
      [WORKTREE]: [
        {
          id: 'group-1',
          worktreeId: WORKTREE,
          activeTabId: 'center',
          tabOrder: tabs.map((tab) => tab.id)
        }
      ]
    },
    activeGroupIdByWorktree: { [WORKTREE]: 'group-1' }
  }
}

function publish(notReadyReason: string | null): void {
  const sideChat: NativeChatSideChat = {
    notReadyReason,
    finishedForkItemId: notReadyReason ? null : 'item-1',
    open: () => new Promise(() => {}),
    reportForkPoint: () => {}
  }
  useSideChatSourceStore.setState({ byTabId: { center: sideChat } })
}

function Frame(): React.JSX.Element {
  return (
    <div className="flex h-[420px] flex-col bg-sidebar text-foreground">
      <SideChatPanel />
    </div>
  )
}

const CENTER = chatTab('center', 'Fix the login redirect')

export const noChat = defineFixture({ width: 380, render: () => <Frame /> })

export const ready = defineFixture({
  width: 380,
  store: workspace([CENTER]),
  setup: () => publish(null),
  render: () => <Frame />
})

export const replyRunning = defineFixture({
  width: 380,
  store: workspace([CENTER]),
  setup: () => publish('Available when this reply finishes.'),
  render: () => <Frame />
})

const DOCKED = [
  CENTER,
  chatTab('side-1', 'Why does the cookie expire early?', true),
  chatTab('side-2', 'Check the redirect tests', true)
]

export const withChatsNarrow = defineFixture({
  width: 360,
  store: workspace(DOCKED),
  setup: () => publish(null),
  render: () => <Frame />
})

export const withChatsWide = defineFixture({
  width: 480,
  store: workspace(DOCKED),
  setup: () => publish(null),
  render: () => <Frame />
})
