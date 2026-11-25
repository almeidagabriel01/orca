import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'
import {
  installClaudeProfileRouter,
  withClaudeProfileTerminalEnv
} from './claude-profile-installed-router'
import { projectClaudeAccountChoiceForWorktree } from '../../selection/claude-chat-account-choice'
import { CLAUDE_PROFILE_POINTER_ENV } from '../../../../shared/agent-accounts/claude/claude-profile-routing'

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

/** Host selects `a`; project `p` defaults Claude to `b`. */
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'orca-project-account-'))
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
    env: {}
  })
  for (const id of ['a', 'b']) {
    mkdirSync(router.accountHome(id), { recursive: true })
    // Signed in, so the project default is usable.
    writeFileSync(
      join(router.accountHome(id), '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: `${id}@example.test` } })
    )
  }
  installClaudeProfileRouter(router)
  const repos: Record<string, { agentLaunchDefaults?: { agentAccounts?: { claude?: string } } }> = {
    p: { agentLaunchDefaults: { agentAccounts: { claude: 'b' } } },
    plain: {},
    sys: { agentLaunchDefaults: { agentAccounts: { claude: 'system' } } }
  }
  const store = { getRepo: (id: string) => repos[id] }
  return { router, store }
}

const pointedHome = (env: Record<string, string>) =>
  readFileSync(env[CLAUDE_PROFILE_POINTER_ENV], 'utf8')

describe('a terminal agent in a project with a default Claude account', () => {
  it('runs on the project account, not the host selection', () => {
    const { router, store } = setup()
    const choice = projectClaudeAccountChoiceForWorktree(store, 'p::/work/p')
    expect(choice).toBe('b')
    const env = withClaudeProfileTerminalEnv({}, { runtime: 'host' }, choice) as Record<
      string,
      string
    >
    // The pane's shell function re-reads the pointer on every `claude`, so it must name `b` too.
    expect(env.CLAUDE_CONFIG_DIR).toBe(router.accountHome('b'))
    expect(pointedHome(env)).toBe(router.accountHome('b'))
    const auth = router.preparation(choice)
    expect(auth.envPatch.CLAUDE_CONFIG_DIR).toBe(router.accountHome('b'))
    expect(readFileSync(auth.envPatch[CLAUDE_PROFILE_POINTER_ENV]!, 'utf8')).toBe(
      router.accountHome('b')
    )
    // Other panes still follow the host's selection.
    expect(readFileSync(router.pointerPath, 'utf8')).toBe(router.accountHome('a'))
  })

  it('runs on System default when the project picks it, though the host selects an account', () => {
    const { store } = setup()
    const choice = projectClaudeAccountChoiceForWorktree(store, 'sys::/work/sys')
    expect(choice).toBe('system')
    const env = withClaudeProfileTerminalEnv({}, { runtime: 'host' }, choice) as Record<
      string,
      string
    >
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(pointedHome(env)).toBe('')
  })

  it('follows the host selection when the project names no account', () => {
    const { router, store } = setup()
    expect(projectClaudeAccountChoiceForWorktree(store, 'plain::/work/plain')).toBeUndefined()
    const env = withClaudeProfileTerminalEnv({}, { runtime: 'host' }, undefined) as Record<
      string,
      string
    >
    expect(env.CLAUDE_CONFIG_DIR).toBe(router.accountHome('a'))
    expect(env[CLAUDE_PROFILE_POINTER_ENV]).toBe(router.pointerPath)
  })
})
