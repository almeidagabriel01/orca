import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCodexAuthIdentity } from '../../../../../codex-accounts/credentials/codex-auth-identity'
import {
  supportsSessionAccountUsage,
  type AgentSessionAccountUsage
} from '../../../../../../shared/agent-session/lifecycle/accounts/agent-session-account-usage'
import type { AgentSessionRecord } from '../../../../../../shared/agent-session/lifecycle/agent-session-record'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import { requireLegacyAgentSessionAccountHome } from '../../../../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import type { RateLimitState } from '../../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { normalizeRuntimePathForComparison } from '../../../../../../shared/file-access/cross-platform-path'
import { buildCodexResetCreditExpectedScope } from '../../../../../../shared/agent-accounts/codex/codex-reset-credit-scope'
import {
  resolveAccountName,
  type AccountIdentity
} from '../../../../../../shared/agent-accounts/account-names'
import { managedAccountIdentity } from '../../../../../../shared/agent-accounts/account-name-identity'
import { getSystemCodexHomePath } from '../../../../../codex/configuration/homes/codex-home-paths'
import { getSelectedCodexAccountIdForTarget } from '../../../../../codex-accounts/account-management/runtime-selection'
import {
  isCodexMethodNotFoundError,
  isCodexAppServerUnsupportedError
} from '../../../../../codex/app-server/codex-app-server-session'
import { CodexUsageApiKeyAuthError } from '../../../../../rate-limits/providers/codex/codex-rpc-rate-limit-mapper'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'
import { OptionsParams } from '../../../../../../shared/rpc-contract/structured-agent-session/structured-agent-session-params'
import '../../../../../../shared/rpc-contract/structured-agent-session/structured-agent-session-continue-params'
import '../../../../../../shared/rpc-contract/structured-agent-session/structured-agent-session-rename-params'
import '../../../../../../shared/rpc-contract/structured-agent-session/structured-agent-session-queued-edit-params'

/** The host's own Codex login, read off the main thread; empty when unreadable. */
async function readSystemCodexIdentity(): Promise<AccountIdentity> {
  const contents = await readFile(join(getSystemCodexHomePath(), 'auth.json'), 'utf-8').catch(
    () => null
  )
  const identity = contents ? readCodexAuthIdentity(contents) : null
  return { email: identity?.email, organization: identity?.workspaceAccountId }
}

export function sessionAccountUsageOffer(
  record: AgentSessionRecord,
  settings: Partial<
    Pick<
      GlobalSettings,
      | 'codexManagedAccounts'
      | 'activeCodexManagedAccountId'
      | 'activeCodexManagedAccountIdsByRuntime'
      | 'accountNames'
    >
  >,
  state: RateLimitState | undefined,
  /** The system login the chat runs on, when it runs on no saved account. */
  systemIdentity: AccountIdentity = {}
) {
  const home = normalizeRuntimePathForComparison(
    requireLegacyAgentSessionAccountHome(record.accountHome).path
  )
  // Usage is offered only for native-local chats, so the chat always runs on the host runtime.
  const target = { runtime: 'host' as const, wslDistro: null }
  const account = (settings.codexManagedAccounts ?? []).find(
    (candidate) =>
      (candidate.managedHomeRuntime ?? 'host') === 'host' &&
      normalizeRuntimePathForComparison(candidate.managedHomePath) === home
  )
  const matches =
    account &&
    state &&
    state.codexTarget.runtime === target.runtime &&
    state.codexTarget.wslDistro === target.wslDistro &&
    getSelectedCodexAccountIdForTarget(
      { ...settings, activeCodexManagedAccountId: settings.activeCodexManagedAccountId ?? null },
      target
    ) === account.id
  const scope = matches
    ? buildCodexResetCreditExpectedScope({ target, account, limits: state.codex })
    : null
  const credits = scope ? state?.codex?.rateLimitResetCredits : undefined
  const displayName = resolveAccountName(
    settings.accountNames,
    'codex',
    account ? managedAccountIdentity(account) : systemIdentity
  )
  return {
    account: account
      ? { kind: 'managed' as const, email: account.email, ...(displayName ? { displayName } : {}) }
      : home === normalizeRuntimePathForComparison(getSystemCodexHomePath())
        ? { kind: 'system' as const, ...(displayName ? { displayName } : {}) }
        : null,
    ...(scope && credits
      ? {
          reset: {
            available: credits.availableCount,
            expiresAt: credits.nextExpiresAt,
            expectedScope: scope
          }
        }
      : {})
  }
}

export const STRUCTURED_AGENT_SESSION_ACCOUNT_USAGE_METHODS = [
  defineMethod({
    name: 'agentSession.accountUsage',
    permission: 'workspace',
    params: OptionsParams,
    handler: async ({ sessionId }, ctx): Promise<AgentSessionAccountUsage> => {
      const host = await requireInstalledStructuredHost(ctx, sessionId)
      const saved = host.deps.store.getRecord(sessionId)
      if (!saved || !supportsSessionAccountUsage(saved)) {
        return { status: 'failed' }
      }
      // The account the chat's next turn runs on, which a switch moves it to.
      const accountHome = await host.deps.launchAccountHome?.(saved).catch(() => null)
      const record = accountHome ? { ...saved, accountHome } : saved
      const abort = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        // Capture the adapter read now; usage never enters the conversation's mutation queue.
        const read = host.deps.agents
          .registration(record.provider)
          ?.adapter.readAccountUsage?.(record, abort.signal)
        if (!read) {
          return { status: 'failed' }
        }
        const result = await Promise.race([
          read,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              abort.abort()
              reject(new Error('Codex usage timed out'))
            }, 40_000)
          })
        ])
        const offer = sessionAccountUsageOffer(
          record,
          ctx.runtime.requireStore().getSettings(),
          await ctx.runtime.getUsageRateLimits()?.getState(),
          await readSystemCodexIdentity()
        )
        return {
          status: 'ok',
          ...offer,
          account: offer.account ?? {
            kind: 'shared',
            ...(result.live && result.account?.email ? { email: result.account.email } : {})
          },
          rateLimits: result.rateLimits
        }
      } catch (error) {
        if (isCodexMethodNotFoundError(error) || isCodexAppServerUnsupportedError(error)) {
          return { status: 'unsupported', reason: 'codexVersion' }
        }
        if (error instanceof CodexUsageApiKeyAuthError) {
          return { status: 'unsupported', reason: 'apiKeyAuth' }
        }
        return { status: 'failed' }
      } finally {
        clearTimeout(timer)
      }
    }
  })
]
