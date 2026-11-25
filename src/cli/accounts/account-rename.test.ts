import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch/dispatch'
import { renameAgentAccount } from './account-rename'

const claudeState = {
  accounts: [
    { id: 'a1', email: 'me@work.example', displayName: 'Work' },
    { id: 'a2', email: 'me@home.example' }
  ],
  activeAccountId: null
}

function context(flags: Record<string, string | boolean>): {
  ctx: HandlerContext
  calls: [string, unknown][]
} {
  const calls: [string, unknown][] = []
  const client = {
    call: async (method: string, params?: unknown) => {
      calls.push([method, params])
      if (method === 'accounts.list') {
        return { id: '1', ok: true, result: { claude: claudeState, codex: claudeState } }
      }
      return { id: '1', ok: true, result: claudeState }
    }
  }
  return {
    ctx: {
      flags: new Map(Object.entries(flags)),
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only calls client.call, which the stub implements
      client: client as unknown as HandlerContext['client'],
      cwd: '/',
      json: true
    },
    calls
  }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('orca account rename', () => {
  it('names System default by its reserved key and clears with an empty label', async () => {
    const { ctx, calls } = context({ agent: 'claude', account: 'system', label: '' })
    await renameAgentAccount(ctx)
    expect(calls).toEqual([['accounts.renameClaude', { accountId: 'system', displayName: '' }]])
  })

  it('resolves a saved account by email or current name', async () => {
    const byEmail = context({ agent: 'codex', account: 'ME@HOME.example', label: 'Home' })
    await renameAgentAccount(byEmail.ctx)
    expect(byEmail.calls.at(-1)).toEqual([
      'accounts.renameCodex',
      { accountId: 'a2', displayName: 'Home' }
    ])

    const byName = context({ agent: 'claude', account: 'work', label: 'Job' })
    await renameAgentAccount(byName.ctx)
    expect(byName.calls.at(-1)).toEqual([
      'accounts.renameClaude',
      { accountId: 'a1', displayName: 'Job' }
    ])
  })

  it('names an Antigravity login globally by its email', async () => {
    const { ctx, calls } = context({
      agent: 'antigravity',
      account: 'me@work.example',
      label: 'Job'
    })
    await renameAgentAccount(ctx)
    expect(calls.at(-1)).toEqual([
      'accounts.setName',
      { provider: 'antigravity', email: 'me@work.example', name: 'Job' }
    ])
  })

  it('refuses a missing label, an unknown Antigravity account and OpenCode/Devin System default', async () => {
    const cases: Record<string, string | boolean>[] = [
      { agent: 'claude', account: 'system', label: true },
      { agent: 'claude', account: 'system' },
      { agent: 'antigravity', account: 'x', label: 'y' },
      { agent: 'devin', account: 'system', label: 'y' }
    ]
    for (const flags of cases) {
      const { ctx, calls } = context(flags)
      await expect(renameAgentAccount(ctx)).rejects.toThrow()
      expect(
        calls.filter(
          ([method]) => method.startsWith('accounts.rename') || method === 'accounts.setName'
        )
      ).toEqual([])
    }
  })
})
