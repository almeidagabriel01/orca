import { describe, expect, it } from 'vitest'
import { parseArgs } from '../arguments/args'
import { RuntimeClientError } from '../runtime/connection/types'
import { REPO_COMMAND_SPECS } from '../specs/repo'
import { REPO_HANDLERS } from './repo'

const SAVED = {
  defaultTuiAgent: 'codex',
  agentLaunchChoices: { codex: { model: 'gpt-5', options: { effort: 'high' } } },
  agentAccounts: { claude: 'acct-1' }
}
const ACCOUNTS = {
  claude: {
    accounts: [
      { id: 'acct-1', email: 'one@example.com', displayName: 'Work' },
      { id: 'acct-wsl', email: 'wsl@example.com', managedAuthRuntime: 'wsl' }
    ]
  }
}

/** Runs `orca repo set` against a host holding `saved`; returns the updates sent, or the error. */
async function repoSet(args: string[], saved: unknown, echo = true) {
  const updates: Record<string, unknown>[] = []
  const call = async (method: string, params: { updates?: Record<string, unknown> }) => {
    if (method === 'accounts.list') {
      return { result: ACCOUNTS }
    }
    if (method === 'repo.show') {
      return { result: { repo: { id: 'r1', agentLaunchDefaults: saved } } }
    }
    updates.push(params.updates ?? {})
    const row = echo ? params.updates?.agentLaunchDefaults : saved
    return { result: { repo: { id: 'r1', ...(row ? { agentLaunchDefaults: row } : {}) } } }
  }
  const { flags } = parseArgs(
    ['repo', 'set', '--repo', 'id:r1', ...args],
    REPO_COMMAND_SPECS.map((spec) => spec.path),
    REPO_COMMAND_SPECS
  )
  const error = await REPO_HANDLERS['repo set']({
    flags,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: repo set uses only client.call, supplied here.
    client: { call } as never,
    cwd: '/',
    json: true
  }).then(
    () => null,
    (failure: unknown) => failure
  )
  return { error, sent: updates[0]?.agentLaunchDefaults, calls: updates.length }
}

describe('orca repo set agent defaults', () => {
  it('merges into the saved record, keeping fields the flags do not name', async () => {
    const { error, sent } = await repoSet(
      [
        '--default-model',
        'claude=opus',
        '--default-effort',
        'claude=max',
        '--default-effort',
        'codex=inherit'
      ],
      SAVED
    )
    expect(error).toBeNull()
    expect(sent).toEqual({
      defaultTuiAgent: 'codex',
      agentLaunchChoices: {
        codex: { model: 'gpt-5' },
        claude: { model: 'opus', options: { effort: 'max' } }
      },
      agentAccounts: { claude: 'acct-1' }
    })
  })

  it('sends null when the last saved field is cleared', async () => {
    const { error, sent } = await repoSet(['--default-agent', 'inherit'], {
      defaultTuiAgent: 'claude'
    })
    expect(error).toBeNull()
    expect(sent).toBeNull()
  })

  it('clears the account with host and resolves a saved one by email', async () => {
    expect((await repoSet(['--default-account', 'host'], SAVED)).sent).toEqual({
      defaultTuiAgent: 'codex',
      agentLaunchChoices: SAVED.agentLaunchChoices
    })
    const byEmail = await repoSet(['--default-account', 'one@example.com'], undefined)
    expect(byEmail.sent).toEqual({ agentAccounts: { claude: 'acct-1' } })
  })

  it.each([
    [['--default-account', 'acct-missing']],
    [['--default-account', 'acct-wsl']],
    [['--default-agent', 'not-an-agent']],
    [['--default-model', 'opus']]
  ])('refuses %j without saving', async (args) => {
    const { error, calls } = await repoSet(args, SAVED)
    expect(error).toBeInstanceOf(RuntimeClientError)
    expect(calls).toBe(0)
  })

  it('fails when the host drops the defaults', async () => {
    const { error } = await repoSet(['--default-agent', 'claude'], undefined, false)
    expect(error).toMatchObject({ code: 'incompatible_runtime' })
  })
})
