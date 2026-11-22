import { describe, expect, it } from 'vitest'
import { foundAgentSessionRecord } from './agent-session-record-founding'
import { replaceAgentSessionRecordOptions } from './agent-session-record-options'
import { isPersistedAgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { AGENT_CHAT_ACCOUNT_OPTION_ID } from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'

function found(options: Record<string, string>) {
  return foundAgentSessionRecord(
    {
      sessionId: 'session-0001',
      location: {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: 'workspace-1',
        workspaceKind: 'folder'
      },
      provider: 'claude',
      accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/user/.claude' },
      options
    },
    { claimKeyId: 'key-1', now: 1 }
  )
}

describe('a chat account choice on the record', () => {
  it('is saved apart from provider options and survives validation', () => {
    const record = found({ model: 'opus', [AGENT_CHAT_ACCOUNT_OPTION_ID]: 'team-account' })
    expect(record.accountChoice).toBe('team-account')
    expect(record.options).toEqual({ model: 'opus' })
    expect(isPersistedAgentSessionRecord(record)).toBe(true)
    expect(isPersistedAgentSessionRecord({ ...record, accountChoice: 'host' })).toBe(false)
  })

  it('never saves the clearing value', () => {
    expect(found({ [AGENT_CHAT_ACCOUNT_OPTION_ID]: 'host' }).accountChoice).toBeUndefined()
  })

  it('changes only while the chat is at rest, and clears with null', () => {
    const record = found({ [AGENT_CHAT_ACCOUNT_OPTION_ID]: 'team-account' })
    const fence = record.lease.runtimeFence
    const cleared = replaceAgentSessionRecordOptions(record, {
      sessionId: record.sessionId,
      fence,
      now: 2,
      accountChoice: null
    })
    expect(cleared.accountChoice).toBeUndefined()
    const live = { ...record, lease: { ...record.lease, claimStatus: 'live' as const } }
    expect(() =>
      replaceAgentSessionRecordOptions(live, {
        sessionId: record.sessionId,
        fence,
        now: 2,
        accountChoice: 'system'
      })
    ).toThrow()
  })
})
