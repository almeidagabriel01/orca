import { describe, expect, it } from 'vitest'
import { ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES } from '../../../../../shared/remote-runtime/protocol/electron-remote-runtime-client-capabilities'
import { IDLE_PASSIVE_CLIENT_CAPABILITY } from '../../../../../shared/remote-runtime/protocol/orcad-runtime-capabilities'
import { projectSessionTabsForInventoryStream } from './session-tabs-client-projection'

const chatStatus = {
  state: 'working' as const,
  updatedAt: 1,
  evidenceObservedAt: 1
}

const snapshot = {
  worktree: 'wt',
  publicationEpoch: 'epoch',
  snapshotVersion: 1,
  activeGroupId: null,
  activeTabId: 'chat-tab',
  activeTabType: 'agent-session' as const,
  tabs: [
    {
      type: 'agent-session' as const,
      id: 'chat-tab',
      title: 'Chat',
      sessionId: 'session-1',
      agent: 'claude' as const,
      chatStatus,
      isActive: true
    }
  ]
}

const hosts = { describeClientHostedBrowserPage: () => undefined }

function chatStatusFor(capabilities: readonly string[]): unknown {
  const projected = projectSessionTabsForInventoryStream(
    snapshot,
    'runtime',
    capabilities as never,
    hosts
  )
  return (projected.tabs[0] as { chatStatus?: unknown }).chatStatus
}

describe('projectSessionTabsForInventoryStream', () => {
  it('keeps chatStatus only for passive watchers on a desktop client', () => {
    expect(
      chatStatusFor([
        ...ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES,
        IDLE_PASSIVE_CLIENT_CAPABILITY
      ])
    ).toEqual(chatStatus)
    expect(chatStatusFor(ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES)).toBeUndefined()
  })
})
