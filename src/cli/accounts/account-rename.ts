import type { HandlerContext } from '../dispatch/dispatch'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState,
  ManagedDataAccountsState
} from '../../shared/agent-accounts/managed-account-types'
import { SYSTEM_DEFAULT_ACCOUNT_NAME_KEY } from '../../shared/agent-accounts/managed-account-display-names'
import { formatAccountsBlock, formatDataAccounts } from './account-list-format'
import { getWslAccountTarget } from './account-wsl-location'
import type { AntigravityAccountState } from '../../shared/agent-accounts/antigravity/antigravity-account-types'
import {
  providerAccounts,
  readAccountFlag,
  readAgentFlag,
  resolveSavedAccountId
} from './account-selection'

/** Antigravity keeps no saved-account names; its login is named globally, by email. */
async function renameAntigravityAccount(
  ctx: HandlerContext,
  query: string,
  name: string
): Promise<void> {
  const { client, cwd, json } = ctx
  const target = getWslAccountTarget(cwd) ?? { runtime: 'host' as const }
  const { accounts } = (
    await client.call<AntigravityAccountState>('accounts.antigravityList', target)
  ).result
  const accountId = resolveSavedAccountId(
    'Antigravity',
    accounts.map((account) => ({ id: account.id, names: [account.email, account.subject] })),
    query
  )
  const email = accounts.find((account) => account.id === accountId)?.email
  if (!email) {
    throw new RuntimeClientError(
      'invalid_argument',
      'This Antigravity account has no email to name it by.'
    )
  }
  printResult(
    await client.call<{ accountNames: unknown }>('accounts.setName', {
      provider: 'antigravity',
      email,
      name
    }),
    json,
    () =>
      name.trim()
        ? `Antigravity account ${email} is now "${name.trim()}".`
        : `Antigravity account ${email} shows its email again.`
  )
}

/** `orca account rename`: only the name Orca shows changes; `--label ""` restores the default. */
export async function renameAgentAccount(ctx: HandlerContext): Promise<void> {
  const agent = readAgentFlag(ctx)
  const query = readAccountFlag(ctx)
  const name = ctx.flags.get('label')
  if (typeof name !== 'string') {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use --label <name>, or --label "" to show the default name.'
    )
  }
  if (agent === 'antigravity') {
    await renameAntigravityAccount(ctx, query, name)
    return
  }
  const provider = providerAccounts(ctx, agent)
  const accountId =
    query === 'system'
      ? null
      : resolveSavedAccountId(provider.label, await provider.choices(), query)
  const { client, json } = ctx
  if (agent === 'claude' || agent === 'codex') {
    const method = agent === 'claude' ? 'accounts.renameClaude' : 'accounts.renameCodex'
    const response = await client.call<ClaudeRateLimitAccountsState | CodexRateLimitAccountsState>(
      method,
      { accountId: accountId ?? SYSTEM_DEFAULT_ACCOUNT_NAME_KEY, displayName: name }
    )
    printResult(response, json, (state) => formatAccountsBlock(provider.label, state))
    return
  }
  // An OpenCode or Devin label is the profile's only name, and System default has none.
  if (accountId === null) {
    throw new RuntimeClientError(
      'invalid_argument',
      `${provider.label} system default has no name.`
    )
  }
  if (!name.trim()) {
    throw new RuntimeClientError(
      'invalid_argument',
      `${provider.label} account names cannot be empty.`
    )
  }
  printResult(
    await client.call<ManagedDataAccountsState>('accounts.renameData', {
      provider: agent,
      accountId,
      label: name
    }),
    json,
    (state) => formatDataAccounts(provider.label, state)
  )
}
