import { describe, expect, it } from 'vitest'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import { encodeAgentSessionRecord } from '../../../../shared/agent-session/lifecycle/records/agent-session-record-stored-form'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { codexProviderHandle } from '../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import { isReadableAgentSessionStoreRecord } from './agent-session-store-row-rules'
import { switchedAgentSessionRecord } from './agent-session-agent-switch-record'

const CODEX_HOME = { variable: 'CODEX_HOME', path: '/home/user/.codex' }

function claudeChat(permissionMode: string): AgentSessionRecord {
  return {
    ...agentSessionRecordFixture(),
    options: { model: 'opus' },
    launchArgs: ['--verbose'],
    launchedAccount: { fence: 7, accountHome: agentSessionRecordFixture().accountHome },
    acquiredAccount: { anything: true },
    permissionMode
  }
}

// What the store writes must load back, or the commit throws and the switch is lost.
const savesAndLoads = (record: AgentSessionRecord) =>
  isReadableAgentSessionStoreRecord(
    record.sessionId,
    JSON.parse(JSON.stringify(encodeAgentSessionRecord(record)))
  )

describe('switchedAgentSessionRecord', () => {
  it('starts another agent fresh and keeps the old conversations attributable', () => {
    const source = claudeChat('ask')
    const switched = switchedAgentSessionRecord(source, {
      switchId: 'switch-1',
      kind: 'agent',
      provider: 'codex',
      accountHome: CODEX_HOME,
      accountChoice: null,
      now: 5_000
    })

    expect(switched).not.toHaveProperty('options')
    expect(switched).not.toHaveProperty('launchArgs')
    expect(switched).not.toHaveProperty('launchedAccount')
    expect(switched).not.toHaveProperty('acquiredAccount')
    expect(switched).toMatchObject({
      provider: 'codex',
      accountHome: CODEX_HOME,
      permissionMode: 'ask',
      providerHandleChain: [],
      providerSegments: [
        { provider: 'claude', startedAt: source.createdAt },
        { provider: 'codex', startedAt: 5_000, switchOperationId: 'switch-1' }
      ],
      retiredConversations: [
        {
          provider: 'claude',
          accountHome: source.accountHome,
          providerSessionIds: ['provider-session-alpha-1']
        }
      ]
    })
    expect(savesAndLoads(switched)).toBe(true)

    // Back again: both stretches' conversations stay, and a mode the new agent lacks is dropped.
    const back = switchedAgentSessionRecord(
      {
        ...switched,
        permissionMode: 'accept-edits',
        providerHandleChain: [
          { ...source.providerHandleChain[0]!, handle: codexProviderHandle('thread-1') }
        ]
      },
      { switchId: 'switch-2', kind: 'agent', provider: 'claude', accountChoice: null, now: 6_000 }
    )
    expect(back.retiredConversations?.map((retired) => retired.provider)).toEqual([
      'claude',
      'codex'
    ])
    expect(back).not.toHaveProperty('permissionMode')
    expect(savesAndLoads(back)).toBe(true)
  })

  it('keeps the conversation and options on another account of the same agent', () => {
    const source = claudeChat('auto')
    const switched = switchedAgentSessionRecord(source, {
      switchId: 'switch-1',
      kind: 'account',
      provider: 'claude',
      accountChoice: 'system',
      now: 5_000
    })

    expect(switched).toMatchObject({
      provider: 'claude',
      accountChoice: 'system',
      options: source.options,
      launchArgs: source.launchArgs,
      permissionMode: 'auto',
      providerHandleChain: source.providerHandleChain
    })
    expect(switched).not.toHaveProperty('retiredConversations')
    expect(savesAndLoads(switched)).toBe(true)
  })
})
