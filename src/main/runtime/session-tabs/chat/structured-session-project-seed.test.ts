import { describe, expect, it } from 'vitest'
import { structuredProjectLaunchSeedOptions } from './structured-session-project-seed'
import { foundAgentSessionRecord } from '../../agent-session/records/agent-session-record-founding'
import { normalizeProjectAgentLaunchDefaults } from '../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { structuredCreateOptions } from '../../../../shared/native-chat/input/session-options/native-chat-session-option-defaults'
import { AGENT_CHAT_ACCOUNT_OPTION_ID as ACCOUNT } from '../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { Repo } from '../../../../shared/repository/repo-types'

const host = {
  agentLaunchChoices: { claude: { model: 'sonnet', options: { effort: 'low' } } }
}
const project: Repo = {
  id: 'project',
  path: '/projects/example',
  displayName: 'Example',
  badgeColor: '',
  addedAt: 1,
  agentLaunchDefaults: normalizeProjectAgentLaunchDefaults({
    agentLaunchChoices: { claude: { model: 'opus', options: { effort: 'high' } } },
    agentAccounts: { claude: 'system', codex: 'system' }
  })
}

/** The account a chat's record founds with, after create merges explicit picks over the seed. */
function foundedAccount(
  seed: Record<string, string> | undefined,
  explicit?: Record<string, string>
) {
  const options = structuredCreateOptions(seed, explicit, true)
  return foundAgentSessionRecord(
    {
      sessionId: 'session-0001',
      location: {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: 'project::/projects/example',
        workspaceKind: 'git-worktree'
      },
      provider: 'claude',
      accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/user/.claude' },
      ...(options ? { options: { ...options } } : {})
    },
    { claimKeyId: 'key-1', now: 1 }
  ).accountChoice
}

describe('a new chat in a project with defaults', () => {
  const seed = structuredProjectLaunchSeedOptions(host, project, 'claude', true)

  it('starts on the project model, effort and account, and leaves projects without defaults alone', () => {
    expect(seed).toMatchObject({ model: 'opus', effort: 'high', [ACCOUNT]: 'system' })
    expect(foundedAccount(seed)).toBe('system')
    const plain = structuredProjectLaunchSeedOptions(
      host,
      { ...project, agentLaunchDefaults: undefined },
      'claude',
      true
    )
    expect(plain).toMatchObject({ model: 'sonnet', effort: 'low' })
    expect(plain?.[ACCOUNT]).toBeUndefined()
    // Accounts are Claude-only today; the codex entry is dropped when saved.
    expect(project.agentLaunchDefaults?.agentAccounts).toEqual({ claude: 'system' })
  })

  it('lets the chat override every default, and "Selected account" clears the project account', () => {
    expect(structuredCreateOptions(seed, { model: 'sonnet' }, true)).toMatchObject({
      model: 'sonnet',
      [ACCOUNT]: 'system'
    })
    expect(foundedAccount(seed, { [ACCOUNT]: 'team-account' })).toBe('team-account')
    expect(foundedAccount(seed, { [ACCOUNT]: 'host' })).toBeUndefined()
  })

  it('keeps the project account when an action replaces the model', () => {
    expect(structuredCreateOptions(seed, { model: 'sonnet' }, false)).toEqual({
      model: 'sonnet',
      [ACCOUNT]: 'system',
      ...(seed?.permissionMode ? { permissionMode: seed.permissionMode } : {})
    })
  })

  it('falls back to the host selection when the project account is gone', () => {
    const stale = {
      ...project,
      agentLaunchDefaults: { agentAccounts: { claude: 'removed-account' } }
    }
    expect(
      structuredProjectLaunchSeedOptions(host, stale, 'claude', true)?.[ACCOUNT]
    ).toBeUndefined()
  })

  it('never shows the account in what the host reports before create', () => {
    expect(structuredProjectLaunchSeedOptions(host, project, 'claude')?.[ACCOUNT]).toBeUndefined()
  })
})
