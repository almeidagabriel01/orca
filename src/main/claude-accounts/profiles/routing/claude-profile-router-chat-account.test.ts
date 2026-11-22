import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'
import { CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE } from './claude-profile-launch-errors'

const saved = (id: string, runtime: 'host' | 'wsl' = 'host') => ({
  id,
  email: `${id}@example.test`,
  authMethod: 'subscription-oauth' as const,
  managedAuthPath: '/unused',
  managedAuthRuntime: runtime,
  createdAt: 0,
  updatedAt: 0,
  lastAuthenticatedAt: 0
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function routerWithAccountASelected(): ClaudeProfileRouter {
  const root = mkdtempSync(join(tmpdir(), 'orca-chat-account-'))
  roots.push(root)
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [saved('a'), saved('b'), saved('w', 'wsl')],
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
  }
  return router
}

describe('a chat that chose its own Claude account', () => {
  it('launches on that account, not the host selection', () => {
    const router = routerWithAccountASelected()
    expect(router.preparation().envPatch.CLAUDE_CONFIG_DIR).toBe(router.accountHome('a'))
    const chosen = router.preparation('b')
    expect(chosen.provenance).toBe('profile:b')
    expect(chosen.envPatch.CLAUDE_CONFIG_DIR).toBe(router.accountHome('b'))
  })

  it('runs System default with no account folder while the host selects one', () => {
    const preparation = routerWithAccountASelected().preparation('system')
    expect(preparation.provenance).toBe('system')
    expect(preparation.envPatch.CLAUDE_CONFIG_DIR).toBeUndefined()
  })

  it('refuses an account that is gone or not native instead of running another', () => {
    const router = routerWithAccountASelected()
    expect(() => router.preparation('removed')).toThrow(CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE)
    expect(() => router.preparation('w')).toThrow(CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE)
  })
})
