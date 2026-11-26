import type { Translate } from '@/i18n/use-translate'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { primarySections } from '@/components/status-bar/usage/usage-headline-sections'
import { formatWindowLabel } from '@/components/status-bar/usage/rate-limit-window-localized-label'
import { formatUsagePercentageLabel } from '@/components/status-bar/usage/usage-percentage-label'
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import {
  clampUsedPercent,
  type UsagePercentageDisplay
} from '../../../../../../shared/agent-usage/display/usage-percentage-display'
import type {
  ProviderRateLimits,
  RateLimitState
} from '../../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { formatUsageLimitResetClock } from '../../../../../../shared/agent-session/failures/agent-session-usage-limit'
import { HOST_SYSTEM_DEFAULT_USAGE_IDS } from '../../../../../../shared/agent-accounts/host-system-default-usage'
import { AGENT_CHAT_SYSTEM_ACCOUNT } from '../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { AgentSessionAgentSwitchTarget } from '../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import { getSystemDefaultDisplayName } from '../../../../../../shared/agent-accounts/managed-account-display-names'
import { claudeChoiceRows, codexHostAccountLabel } from './host-claude-chat-accounts'
import { offeredSwitchAgents, type SwitchFilter } from './native-chat-agent-switch-offered'

export type SwitchRowUsage = {
  text: string
  /** Spent until this reset, which is still ahead; the row can't take the chat until then. */
  spentUntil?: number
}

export type SwitchRow = {
  value: string
  agent: string
  /** Claude's accounts, then the other agents. */
  group: 'claude' | 'agent'
  label: string
  description?: string
  /** The account the host uses now, badged "default". */
  isDefault?: boolean
  usage?: SwitchRowUsage
  disabled: boolean
  /** How the stop-and-switch confirmation names the destination. */
  destination: string
  target: AgentSessionAgentSwitchTarget
}

export type AgentSwitchMenuModel = {
  rows: SwitchRow[]
  /** Agents left out as not installed or signed out; "Show all providers" brings them back. */
  hiddenCount: number
  /** The row of the chat's saved choice. */
  value: string
  /** What the composer pill shows. */
  currentLabel: string
}

type ModelInput = SwitchFilter & {
  agent: string
  agents: readonly string[]
  choice: string | undefined
  accounts: ProviderAccountsSnapshot | null
  usage: RateLimitState | null
  display: UsagePercentageDisplay
  now: number
  /** The interface's Intl locale, so reset times read like the rest of the UI (22:35 in pt-BR). */
  locale: string
  t: Translate
}

const WEEK_MINUTES = 7 * 24 * 60

const joinedParts = (...parts: (string | null | undefined)[]): string =>
  parts.filter((part): part is string => Boolean(part)).join(' · ')

const agentRowValue = (agent: string): string => `agent:${agent}`
const accountRowValue = (choice: string): string => `claude:${choice}`

/** One account's tightest live window as "5h · 36% left", or when a spent window resets. */
export function switchRowUsage(
  limits: ProviderRateLimits | null | undefined,
  display: UsagePercentageDisplay,
  now: number,
  locale: string,
  t: Translate
): SwitchRowUsage | undefined {
  // A window whose reset has passed holds a stale reading.
  const live = limits
    ? primarySections(limits, t).filter(
        (section) => section.window.resetsAt === null || section.window.resetsAt > now
      )
    : []
  if (live.length === 0) {
    return undefined
  }
  const spent = live.filter((section) => clampUsedPercent(section.window.usedPercent) >= 100)
  if (spent.length > 0) {
    const resets = spent
      .map((section) => section.window.resetsAt)
      .filter((reset): reset is number => reset !== null)
    const until = resets.length === spent.length ? Math.max(...resets) : null
    return until === null
      ? { text: t('components.native-chat.agentSwitch.limitReached', 'Limit reached') }
      : {
          text: t('components.native-chat.agentSwitch.limitedUntil', 'Limited until {{time}}', {
            time: formatUsageLimitResetClock(until, now, locale).replace(/\s/g, '\u00a0')
          }),
          spentUntil: until
        }
  }
  const tightest = live.reduce((current, candidate) =>
    clampUsedPercent(candidate.window.usedPercent) > clampUsedPercent(current.window.usedPercent)
      ? candidate
      : current
  )
  return {
    text: t('components.native-chat.agentSwitch.usageWindow', '{{window}} · {{usage}}', {
      // Spelled out: the app's short week label reads as another word in some languages (pt "sem").
      window:
        tightest.window.windowMinutes === WEEK_MINUTES
          ? t('components.native-chat.agentSwitch.windowWeek', 'week')
          : formatWindowLabel(tightest.window.windowMinutes),
      usage: formatUsagePercentageLabel(tightest.window.usedPercent, display, t)
    })
  }
}

/** The host's reading for one Claude usage key: live for the account it reads, else its last. */
function claudeLimits(
  usage: RateLimitState | null,
  usageId: string,
  hostUsageId: string
): ProviderRateLimits | null {
  const live = usage?.claude
  if (!usage || live?.usageMetadata?.unverifiableOwner) {
    return null
  }
  const reading = live?.usageMetadata?.readingAccount
  // Older hosts don't name the reading's account; it is then the host's selection.
  const liveId = reading
    ? reading.runtime === 'host'
      ? reading.accountId
      : null
    : usage.claudeTarget.runtime === 'host'
      ? hostUsageId
      : null
  if (live && liveId === usageId) {
    return live
  }
  return (
    usage.inactiveClaudeAccounts.find((entry) => entry.accountId === usageId)?.rateLimits ?? null
  )
}

function codexLimits(usage: RateLimitState | null): ProviderRateLimits | null {
  const live = usage?.codex
  return live && !live.usageMetadata?.unverifiableOwner && usage?.codexTarget.runtime === 'host'
    ? live
    : null
}

/** The "Continue with" rows: each Claude account once (own login included), then the other agents. */
export function agentSwitchMenuModel(input: ModelInput): AgentSwitchMenuModel {
  const { agent, choice, usage, display, now, locale, t } = input
  const usageOf = (limits: ProviderRateLimits | null): SwitchRowUsage | undefined =>
    switchRowUsage(limits, display, now, locale, t)
  const claudeName = structuredAgentLabel('claude')
  const named = (name: string, account: string): string => `${name} · ${account}`
  const hostAccount = t('components.native-chat.agentSwitch.hostAccount', 'Host account')
  const ownLogin = t('accounts.ownLogin', "This computer's login")

  const claude =
    input.accounts && !input.accounts.failedProviders?.includes('claude')
      ? input.accounts.claude
      : null
  const resolved = claude ? claudeChoiceRows(claude, choice, ownLogin) : null
  // Only the own login: the chat has nothing to pick between, so it shows as the agent.
  const concrete = resolved && resolved.rows.some((row) => row.value !== AGENT_CHAT_SYSTEM_ACCOUNT)
  const shown = offeredSwitchAgents(input, Boolean(concrete))
  const offersClaude = input.agents.includes('claude') && !shown.claudeHidden
  const hostUsageId = claude?.activeAccountId ?? HOST_SYSTEM_DEFAULT_USAGE_IDS.claude
  const value =
    agent !== 'claude'
      ? agentRowValue(agent)
      : resolved && concrete
        ? accountRowValue(resolved.value)
        : agentRowValue('claude')
  const inUse = t('components.native-chat.agentSwitch.inUse', 'In use')
  const blocked = (rowValue: string, rowUsage: SwitchRowUsage | undefined): boolean =>
    rowUsage?.spentUntil !== undefined && rowValue !== value

  const ownName = (claude && getSystemDefaultDisplayName(claude)) ?? ownLogin
  const claudeRows: SwitchRow[] = !offersClaude
    ? []
    : !resolved || !concrete
      ? [
          {
            value: agentRowValue('claude'),
            agent: 'claude',
            group: 'claude',
            label: claude ? ownName : hostAccount,
            ...(claude ? { isDefault: true } : {}),
            disabled: false,
            destination: claudeName,
            target: { agent: 'claude' }
          }
        ]
      : resolved.rows.map((row): SwitchRow => {
          const rowValue = accountRowValue(row.value)
          const usageId =
            row.value === AGENT_CHAT_SYSTEM_ACCOUNT
              ? HOST_SYSTEM_DEFAULT_USAGE_IDS.claude
              : row.value
          const rowUsage = usageOf(claudeLimits(usage, usageId, hostUsageId))
          const description = joinedParts(rowValue === value ? inUse : null, row.description)
          return {
            value: rowValue,
            agent: 'claude',
            group: 'claude',
            label: row.label,
            ...(description ? { description } : {}),
            ...(rowUsage ? { usage: rowUsage } : {}),
            ...(row.isDefault ? { isDefault: true } : {}),
            disabled: blocked(rowValue, rowUsage),
            destination: named(claudeName, row.label),
            target: { agent: 'claude', accountChoice: row.value }
          }
        })

  const codexAccount = codexHostAccountLabel(input.accounts)
  const agentRows: SwitchRow[] = shown.otherAgents.map((other): SwitchRow => {
    // Codex runs on the host's account, so its one row is the default one.
    const account = other === 'codex' ? codexAccount : null
    const destination = account
      ? named(structuredAgentLabel(other), account)
      : structuredAgentLabel(other)
    const rowUsage = other === 'codex' ? usageOf(codexLimits(usage)) : undefined
    const rowValue = agentRowValue(other)
    return {
      value: rowValue,
      agent: other,
      group: 'agent',
      label: account ?? hostAccount,
      ...(rowValue === value ? { description: inUse } : {}),
      ...(rowUsage ? { usage: rowUsage } : {}),
      ...(account ? { isDefault: true } : {}),
      disabled: blocked(rowValue, rowUsage),
      destination,
      target: { agent: other }
    }
  })

  const rows = [...claudeRows, ...agentRows]
  const currentLabel =
    agent !== 'claude'
      ? named(structuredAgentLabel(agent), (agent === 'codex' && codexAccount) || hostAccount)
      : (rows.find((row) => row.agent === 'claude' && row.value === value && concrete)?.label ??
        claudeName)
  return { rows, hiddenCount: shown.hiddenCount, value, currentLabel }
}
