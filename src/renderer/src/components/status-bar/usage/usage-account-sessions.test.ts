import { describe, expect, it } from 'vitest'
import {
  collectChatSessions,
  collectTerminalSessions,
  identifyHostSessions,
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

describe('a chat whose turn ended while its background work runs', () => {
  const state = (extra: Partial<UsageChatInput>) =>
    collectChatSessions([chat('worker', { status: 'idle', ...extra })], NOW)[0]?.state

  it('still counts as working, like the sidebar shows it', () => {
    expect(state({ backgroundTasks: [{ id: 'ci', kind: 'command', state: 'working' }] })).toBe(
      'working'
    )
    expect(state({ backgroundTasks: [{ id: 'sub', kind: 'agent' }] })).toBe('working')
  })

  it('is recent once every background task settled', () => {
    expect(state({ backgroundTasks: [{ id: 'ci', kind: 'command', state: 'done' }] })).toBe(
      'recent'
    )
    expect(state({})).toBe('recent')
  })
})

describe('the same account on another host', () => {
  const vps = { environmentId: 'env-vps', label: 'VPS' }
  const vpsAccounts = {
    claude: [
      { key: 'vps-id-1', selected: true, name: { email: 'Me@Example.com' } },
      { key: 'vps-id-2', selected: false, name: { email: 'other@example.com' } }
    ]
  }
  const vpsSessions = collectChatSessions(
    [
      chat('follows-selection', {}),
      chat('named-account', { accountChoice: 'vps-id-2' }),
      chat('unknown-account', { accountChoice: 'gone' })
    ],
    NOW
  )
  const elsewhere = identifyHostSessions(vpsSessions, vpsAccounts, vps)

  it('names each agent by the email of the login it bills, never by the local id', () => {
    expect(elsewhere.map((s) => [s.title, s.elsewhere?.identity])).toEqual([
      ['follows-selection', 'claude:me@example.com'],
      ['named-account', 'claude:other@example.com']
    ])
  })

  it("lists them on this host's chip of that login, beside its own agents", () => {
    const own = collectChatSessions([chat('mac-chat', { accountChoice: 'mac-id-9' })], NOW)
    const scope = {
      provider: 'claude',
      accountKey: 'mac-id-9',
      selected: false,
      accountIdentity: 'claude:me@example.com'
    }
    expect(sessionsInScope([...own, ...elsewhere], scope).map((s) => s.title)).toEqual([
      'mac-chat',
      'follows-selection'
    ])
    // A matching local key alone never pulls in another host's agent.
    expect(
      sessionsInScope(elsewhere, { provider: 'claude', accountKey: 'vps-id-2' }).map((s) => s.title)
    ).toEqual([])
  })
})
