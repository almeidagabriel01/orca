import { afterEach, expect, it } from 'vitest'
import { setStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { agentSessionConversationView } from '../../../shared/agent-session/lifecycle/leases/agent-session-conversation-view'
import { agentSessionRecordFixture } from '../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import type { AgentSessionConversationKeys } from '../../runtime/agent-session/records/agent-session-conversation-key-index'
import { switchedAgentSessionRecord } from '../../runtime/agent-session/records/agent-session-agent-switch-record'
import {
  assertLegacyAiVaultResumeCommandAllowed,
  OPENS_EVERY_STRUCTURED_CHAT,
  projectStructuredAiVaultSessions
} from './structured-session-ownership'
import {
  codexChatHolding,
  historySession,
  installChats,
  installOwnership,
  listResult,
  PROVIDER_SESSION
} from './structured-session-ownership.test-support'

// The host is process-wide: a shared test runner must not hand this partial one to the next file.
afterEach(() => setStructuredAgentSessionHost(null))

it.each([
  // The line Session History copies for a real-home Codex session.
  `cd '/repo' && env -u CODEX_HOME -u ORCA_CODEX_HOME codex 'resume' '${PROVIDER_SESSION}'`,
  `sudo -u dev codex resume ${PROVIDER_SESSION}`
])('refuses an owned resume behind launcher options: %s', async (command) => {
  installOwnership()

  await expect(
    assertLegacyAiVaultResumeCommandAllowed(command, async () => undefined)
  ).rejects.toThrow('agent_session_conflict')
})

it('lists a Cursor ACP session only as its owning chat, previewed from the last turn', () => {
  const owned = '6f1c2a54-0d4e-4c55-9a7e-2b8f0c1d3e4a'
  installOwnership({
    handle: { transport: 'acp', agent: 'cursor', nativeId: owned },
    providerSessionId: owned,
    lastTurn: {
      state: 'settled',
      at: Date.parse('2026-11-20T09:30:00.000Z'),
      prompt: 'Fix the build',
      reply: 'Fixed.'
    }
  })
  const acpRow = (sessionId: string) =>
    historySession({
      id: `local:cursor:${sessionId}`,
      agent: 'cursor',
      sessionId,
      filePath: `/home/ada/.cursor/acp-sessions/${sessionId}/store.db`,
      messageCount: 0,
      resumeCommand: ''
    })
  const result = projectStructuredAiVaultSessions(
    {
      ...listResult(),
      sessions: [
        acpRow(owned),
        // Forgotten since the scan.
        acpRow('aaaaaaaa-0000-4000-8000-000000000000'),
        // A runtime host projected its own chat's row before this one restamped it.
        {
          ...acpRow('bbbbbbbb-0000-4000-8000-000000000000'),
          executionHostId: 'runtime:remote',
          structuredSession: { sessionId: 'remote-chat', workspaceId: 'remote-workspace' }
        }
      ]
    },
    OPENS_EVERY_STRUCTURED_CHAT
  )

  expect(result.sessions).toEqual([
    expect.objectContaining({
      sessionId: owned,
      structuredSession: { sessionId: 'session-alpha', workspaceId: 'workspace-1' },
      previewMessages: [
        { role: 'user', text: 'Fix the build', timestamp: '2026-11-20T09:30:00.000Z' },
        { role: 'assistant', text: 'Fixed.', timestamp: '2026-11-20T09:30:00.000Z' }
      ]
    }),
    expect.objectContaining({ sessionId: 'bbbbbbbb-0000-4000-8000-000000000000' })
  ])
})

it('keeps a conversation of the agent a chat switched away from as that chat', () => {
  const claude = agentSessionRecordFixture()
  const chat = switchedAgentSessionRecord(claude, {
    switchId: 'switch-1',
    kind: 'agent',
    provider: 'codex',
    accountHome: { variable: 'CODEX_HOME', path: '/home/user/.codex' },
    accountChoice: null,
    now: 5_000
  })
  const view = agentSessionConversationView(chat)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the projection reads only these store members; the rest of the host is never reached.
  setStructuredAgentSessionHost({
    deps: {
      store: {
        hostId: 'local',
        getRecord: (sessionId: string) => (sessionId === chat.sessionId ? chat : null),
        conversationsKeyedBy: (keys: AgentSessionConversationKeys, key: string) =>
          keys(view).includes(key) ? [view] : []
      }
    }
  } as never)
  const claudeRow = historySession({
    id: 'local:claude:provider-session-alpha-1',
    agent: 'claude',
    sessionId: 'provider-session-alpha-1'
  })

  const result = projectStructuredAiVaultSessions(
    { ...listResult(), sessions: [claudeRow] },
    OPENS_EVERY_STRUCTURED_CHAT
  )

  expect(result.sessions).toEqual([
    expect.objectContaining({
      sessionId: 'provider-session-alpha-1',
      structuredSession: { sessionId: chat.sessionId, workspaceId: 'workspace-1' }
    })
  ])
})

it('lists a chat that holds a rewound-away conversation once, as its head', () => {
  const original = '019fd532-7c11-7a90-b6de-4e1a2c3d5f61'
  const rewound = '019fd532-7c11-7a90-b6de-4e1a2c3d5f62'
  installChats([codexChatHolding('chat-1', [original, rewound])])
  const row = (sessionId: string) =>
    historySession({
      id: `local:codex:${sessionId}`,
      sessionId,
      filePath: `/sessions/rollout-${sessionId}.jsonl`
    })

  const result = projectStructuredAiVaultSessions(
    { ...listResult(), sessions: [row(original), row(rewound)] },
    OPENS_EVERY_STRUCTURED_CHAT
  )

  expect(result.sessions).toEqual([
    expect.objectContaining({
      sessionId: rewound,
      structuredSession: { sessionId: 'chat-1', workspaceId: 'workspace-1' }
    })
  ])
  // Show more still sees a full scan.
  expect(result.hiddenRowCount).toBe(1)
})
