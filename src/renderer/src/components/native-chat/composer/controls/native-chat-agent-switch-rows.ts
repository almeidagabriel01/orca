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
import { CLAUDE_HOST_SYSTEM_DEFAULT_USAGE_ID } from '../../../../../../shared/agent-accounts/claude/claude-system-default-usage'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  AGENT_CHAT_SYSTEM_ACCOUNT,
  agentSupportsChatAccountChoice
} from '../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { AgentSessionAgentSwitchTarget } from '../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import { claudeChatAccountRows, codexHostAccountLabel } from './host-claude-chat-accounts'

export type SwitchRowUsage = {
  text: string
  /** Spent until this reset, which is still ahead; the row can't take the chat until then. */
  spentUntil?: number
}

export type SwitchRow = {
  value: string
  agent: string
  /** Concrete Claude accounts, then the other agents, then the rules a Claude chat can follow. */
  group: 'claude' | 'agent' | 'rule'
  label: string
  description?: string
  usage?: SwitchRowUsage
  disabled: boolean
  /** How the stop-and-switch confirmation names the destination. */
  destination: string
  target: AgentSessionAgentSwitchTarget
}

export type AgentSwitchMenuModel = {
  rows: SwitchRow[]
  /** The row of the chat's saved choice. */
  value: string
  /** What the composer pill shows. */
  currentLabel: string
}

type ModelInput = {
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

/** The "Continue with" rows: each concrete account once, the other agents, then distinct rules. */
export function agentSwitchMenuModel(input: ModelInput): AgentSwitchMenuModel {
  const { agent, choice, usage, display, now, locale, t } = input
  const usageOf = (limits: ProviderRateLimits | null): SwitchRowUsage | undefined =>
    switchRowUsage(limits, display, now, locale, t)
  const claudeName = structuredAgentLabel('claude')
  const named = (name: string, account: string): string => `${name} · ${account}`
  const hostAccount = t('components.native-chat.agentSwitch.hostAccount', 'Host account')
  const systemDefault = t('components.native-chat.account.systemDefault', 'System default')

  const claude =
    input.accounts && !input.accounts.failedProviders?.includes('claude')
      ? input.accounts.claude
      : null
  const concrete = claude ? claudeChatAccountRows(claude) : []
  const offersClaude = input.agents.includes('claude')
  const saved = choice ?? AGENT_CHAT_HOST_ACCOUNT
  const hostId = claude?.activeAccountId ?? null
  const hostUsageId = hostId ?? CLAUDE_HOST_SYSTEM_DEFAULT_USAGE_ID
  const systemEmail = claude?.systemDefaultEmail
  const systemMatch = systemEmail ? concrete.find((row) => row.email === systemEmail) : undefined
  const hostRow = hostId ? concrete.find((row) => row.value === hostId) : systemMatch
  const hostNow = hostRow?.label ?? (hostId ? undefined : (systemEmail ?? systemDefault))
  const value =
    agent !== 'claude'
      ? agentRowValue(agent)
      : concrete.length === 0
        ? agentRowValue('claude')
        : accountRowValue(saved)
  // The concrete account a rule resolves to, while the chat runs on Claude.
  const inUseId =
    agent !== 'claude'
      ? undefined
      : saved === AGENT_CHAT_HOST_ACCOUNT
        ? hostRow?.value
        : saved === AGENT_CHAT_SYSTEM_ACCOUNT
          ? systemMatch?.value
          : undefined
  const inUse = t('components.native-chat.agentSwitch.inUse', 'In use')
  const blocked = (rowValue: string, rowUsage: SwitchRowUsage | undefined): boolean =>
    rowUsage?.spentUntil !== undefined && rowValue !== value

  const claudeRows: SwitchRow[] = !offersClaude
    ? []
    : concrete.length === 0
      ? [
          {
            value: agentRowValue('claude'),
            agent: 'claude',
            group: 'claude',
            label: hostAccount,
            disabled: false,
            destination: claudeName,
            target: { agent: 'claude' }
          }
        ]
      : concrete.map((row): SwitchRow => {
          const rowValue = accountRowValue(row.value)
          const rowUsage = usageOf(claudeLimits(usage, row.value, hostUsageId))
          const description = joinedParts(
            row.value === inUseId || rowValue === value ? inUse : null,
            row.description
          )
          return {
            value: rowValue,
            agent: 'claude',
            group: 'claude',
            label: row.label,
            ...(description ? { description } : {}),
            ...(rowUsage ? { usage: rowUsage } : {}),
            disabled: blocked(rowValue, rowUsage),
            destination: named(claudeName, row.label),
            target: { agent: 'claude', accountChoice: row.value }
          }
        })

  const otherAgents = [...new Set([...input.agents, agent])].filter((other) => other !== 'claude')
  const codexAccount = codexHostAccountLabel(input.accounts)
  const agentRows: SwitchRow[] = otherAgents.map((other): SwitchRow => {
    const hostOnly = !agentSupportsChatAccountChoice(other)
    const account = other === 'codex' ? codexAccount : null
    const label = account ?? hostAccount
    const destination = account
      ? named(structuredAgentLabel(other), account)
      : structuredAgentLabel(other)
    const rowUsage = other === 'codex' ? usageOf(codexLimits(usage)) : undefined
    const rowValue = agentRowValue(other)
    const description = joinedParts(
      rowValue === value ? inUse : null,
      hostOnly && account ? hostAccount : null
    )
    return {
      value: rowValue,
      agent: other,
      group: 'agent',
      label,
      ...(description ? { description } : {}),
      ...(rowUsage ? { usage: rowUsage } : {}),
      disabled: blocked(rowValue, rowUsage),
      destination,
      target: { agent: other }
    }
  })

  const ruleRows: SwitchRow[] = []
  if (offersClaude && concrete.length > 0) {
    ruleRows.push({
      value: accountRowValue(AGENT_CHAT_HOST_ACCOUNT),
      agent: 'claude',
      group: 'rule',
      label: t('components.native-chat.agentSwitch.followHost', 'Follow the host'),
      description: hostNow
        ? t(
            'components.native-chat.agentSwitch.followHostNow',
            "Uses the host's selected account, now {{account}}",
            { account: hostNow }
          )
        : t(
            'components.native-chat.agentSwitch.followHostHint',
            "Uses the host's selected account"
          ),
      disabled: false,
      destination: named(claudeName, hostNow ?? hostAccount),
      target: { agent: 'claude', accountChoice: AGENT_CHAT_HOST_ACCOUNT }
    })
    // Offered only when it reaches a login no saved account covers, or when it is the chat's pick.
    if (saved === AGENT_CHAT_SYSTEM_ACCOUNT || (systemEmail && !systemMatch)) {
      const rowValue = accountRowValue(AGENT_CHAT_SYSTEM_ACCOUNT)
      const rowUsage = systemMatch
        ? undefined
        : usageOf(claudeLimits(usage, CLAUDE_HOST_SYSTEM_DEFAULT_USAGE_ID, hostUsageId))
      ruleRows.push({
        value: rowValue,
        agent: 'claude',
        group: 'rule',
        label: t('components.native-chat.agentSwitch.systemDefault', 'System default'),
        description: systemEmail
          ? t(
              'components.native-chat.agentSwitch.systemDefaultLogin',
              "The host's own Claude login, {{email}}",
              { email: systemEmail }
            )
          : t(
              'components.native-chat.agentSwitch.systemDefaultLoginUnnamed',
              "The host's own Claude login"
            ),
        ...(rowUsage ? { usage: rowUsage } : {}),
        disabled: blocked(rowValue, rowUsage),
        destination: named(claudeName, systemEmail ?? systemDefault),
        target: { agent: 'claude', accountChoice: AGENT_CHAT_SYSTEM_ACCOUNT }
      })
    }
  }

  // The rules close the Claude group; each other agent follows as its own group.
  const rows = [...claudeRows, ...ruleRows, ...agentRows]
  const pinned = concrete.find((row) => row.value === saved)
  const currentLabel =
    agent !== 'claude'
      ? named(structuredAgentLabel(agent), (agent === 'codex' && codexAccount) || hostAccount)
      : !claude || concrete.length === 0
        ? claudeName
        : pinned
          ? pinned.label
          : saved === AGENT_CHAT_SYSTEM_ACCOUNT
            ? (systemEmail ?? systemDefault)
            : saved === AGENT_CHAT_HOST_ACCOUNT
              ? (hostNow ?? claudeName)
              : claudeName
  return { rows, value, currentLabel }
}
