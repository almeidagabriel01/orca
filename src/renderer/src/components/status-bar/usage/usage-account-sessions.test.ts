import { describe, expect, it } from 'vitest'
import {
  collectChatSessions,
  collectTerminalSessions,
  sessionsInScope,
  type UsageChatInput,
  type UsageTerminalInput
} from './usage-account-sessions'

const NOW = 10_000_000
const chat = (sessionId: string, extra: Partial<UsageChatInput>): UsageChatInput => ({
  sessionId,
  workspaceId: 'ws',
  agent: 'claude',
  status: 'working',
  updatedAt: NOW - 1_000,
  title: sessionId,
  ...extra
})
const pane = (paneKey: string, extra: Partial<UsageTerminalInput>): UsageTerminalInput => ({
  paneKey,
  tabId: 'tab',
  worktreeId: 'ws',
  agentType: 'claude',
  rowState: 'working',
  stateStartedAt: NOW - 5_000,
  updatedAt: NOW - 1_000,
  title: paneKey,
  ...extra
})

describe('usage account sessions', () => {
  const sessions = [
    ...collectChatSessions(
      [
        chat('follows-selection', {}),
        chat('picked-gabriel', { accountChoice: 'acct-gabriel' }),
        chat('picked-system', { accountChoice: 'system', status: 'attention' }),
        chat('codex-chat', { agent: 'codex' }),
        chat('finished-long-ago', { status: 'idle', updatedAt: NOW - 2 * 60 * 60_000 }),
        chat('unnamed-no-status', { status: null })
      ],
      NOW
    ),
    ...collectTerminalSessions(
      [
        pane('terminal-selected', {}),
        // Launched on gestao, still waiting on its restart prompt after a switch to gabriel.
        pane('terminal-before-switch', {
          restartNotice: {
            previousAccountLabel: 'gestao',
            nextAccountLabel: 'gabriel',
            previousAccountId: 'acct-gestao',
            nextAccountId: 'acct-gabriel'
          }
        }),
        pane('terminal-restarted', {
          restartNotice: {
            previousAccountLabel: 'gestao',
            nextAccountLabel: 'gabriel',
            previousAccountId: 'acct-gestao',
            restartRequested: true
          }
        }),
        pane('terminal-silent', { rowState: 'unverifiable' }),
        pane('terminal-done', { rowState: 'done' }),
        pane('shell', { agentType: 'unknown' })
      ],
      NOW
    )
  ]
  const keys = (list: { key: string }[]) => list.map((session) => session.key)

  it('gives each account the agents that bill it, the selected one those following the host', () => {
    // gabriel is the host's selected account.
    expect(
      keys(
        sessionsInScope(sessions, {
          provider: 'claude',
          accountKey: 'acct-gabriel',
          selected: true
        })
      )
    ).toEqual([
      'chat:follows-selection',
      'chat:picked-gabriel',
      'pane:terminal-selected',
      'pane:terminal-restarted',
      'pane:terminal-done'
    ])
    expect(
      keys(sessionsInScope(sessions, { provider: 'claude', accountKey: 'acct-gestao' }))
    ).toEqual(['pane:terminal-before-switch'])
    expect(
      keys(sessionsInScope(sessions, { provider: 'claude', accountKey: 'system-default' }))
    ).toEqual(['chat:picked-system'])
  })

  it('lists waiting first, then working, then recent; a provider chip takes all its accounts', () => {
    const all = sessionsInScope(sessions, { provider: 'claude' })
    expect(all.map((session) => session.state)).toEqual([
      'waiting',
      'working',
      'working',
      'working',
      'working',
      'working',
      'recent'
    ])
    expect(keys(sessionsInScope(sessions, { provider: 'codex' }))).toEqual(['chat:codex-chat'])
  })
})
