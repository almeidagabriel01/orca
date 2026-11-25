import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ClaudeProfileRouter,
  type ClaudeProfileRouterSettings
} from '../../../claude-accounts/profiles/routing/claude-profile-router'
import { installClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import { claudeProfileMarkerPath } from '../../../claude-accounts/profiles/claude-profile-paths'
import { chatLaunchAccountChoice } from '../../../claude-accounts/selection/claude-chat-account-choice'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/records/agent-session-record.test-fixture'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { createClaudeStructuredLaunchResolver } from '../../../runtime/agent-session/launch/structured-agent-launch-composition.test-support'

const saved = (id: string) => ({
  id,
  email: `${id}@example.test`,
  authMethod: 'subscription-oauth' as const,
  managedAuthPath: '/unused',
  managedAuthRuntime: 'host' as const,
  createdAt: 0,
  updatedAt: 0,
  lastAuthenticatedAt: 0
})

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

/** Real router with signed-in accounts a and b, the host selecting a; project `p` defaults to b. */
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'orca-chat-project-account-'))
  roots.push(root)
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [saved('a'), saved('b')],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot: root,
    userHome: join(root, 'personal'),
    env: {},
    runSetup: async ({ profile }) => {
      mkdirSync(profile.home, { recursive: true })
      writeFileSync(claudeProfileMarkerPath(profile), '{}')
      return { outcome: 'prepared', warnings: [], surfaces: {} }
    }
  })
  for (const id of ['a', 'b']) {
    mkdirSync(router.accountHome(id), { recursive: true })
    writeFileSync(
      join(router.accountHome(id), '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: `${id}@example.test` } })
    )
  }
  mkdirSync(router.systemDefaultHome(), { recursive: true })
  installClaudeProfileRouter(router)
  const repos: Record<string, { agentLaunchDefaults?: { agentAccounts?: { claude?: string } } }> = {
    p: { agentLaunchDefaults: { agentAccounts: { claude: 'b' } } },
    plain: {}
  }
  const repoStore = { getRepo: (id: string) => repos[id] }

  /** Where Claude starts for a chat saved in `workspaceId`, as the adapter's acquisition resolves it. */
  const launchHome = async (
    workspaceId: string,
    edit: (record: AgentSessionRecord) => AgentSessionRecord = (record) => record
  ) => {
    const base = agentSessionRecordFixture()
    const record = edit({
      ...base,
      location: { ...base.location, workspaceId },
      accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: router.systemDefaultHome() }
    })
    const resolve = createClaudeStructuredLaunchResolver({
      store: { getRecord: () => record, pinLaunchDirectory: async () => record },
      resolveLaunchArgs: () => [],
      resolveCommand: () => ({ command: '/usr/local/bin/claude', prefixArgs: [] }),
      resolveInheritedEnv: async () => ({ PATH: '/usr/bin' }),
      resolveAuthPolicy: () => ({ account: 'system' }),
      hasTranscript: async () => true,
      launchAccountChoice: (saved) => chatLaunchAccountChoice(repoStore, saved)
    })
    const launch = await resolve({
      identity: {
        sessionId: record.sessionId,
        workspaceId,
        hostId: 'local',
        agent: 'claude',
        providerHandle: record.providerHandleChain[0]!.handle
      }
    })
    return launch.claudeConfigDir
  }
  return { router, launchHome }
}

describe('a structured chat saved without an account', () => {
  it('resumes on its project default account, not the host selection', async () => {
    const { router, launchHome } = setup()
    expect(await launchHome('p::/work/p')).toBe(router.accountHome('b'))
  })

  it('an adopted CLI conversation also launches on the project default account', async () => {
    const { router, launchHome } = setup()
    const adopted = (record: AgentSessionRecord): AgentSessionRecord => ({
      ...record,
      providerHandleChain: record.providerHandleChain.map((link) => ({
        ...link,
        origin: 'resumed' as const
      }))
    })
    expect(await launchHome('p::/work/p', adopted)).toBe(router.accountHome('b'))
  })

  it('follows the host selection in a project without a default', async () => {
    const { router, launchHome } = setup()
    expect(await launchHome('plain::/work/plain')).toBe(router.accountHome('a'))
  })

  it('keeps its own saved choice over the project default', async () => {
    const { router, launchHome } = setup()
    const pinned = (record: AgentSessionRecord): AgentSessionRecord => ({
      ...record,
      accountChoice: 'a'
    })
    expect(await launchHome('p::/work/p', pinned)).toBe(router.accountHome('a'))
  })
})
