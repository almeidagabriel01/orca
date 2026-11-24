import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type {
  ProviderRateLimits,
  RateLimitState
} from '../../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { codexHostAccountLabel } from './host-claude-chat-accounts'

/** The usage reading that shows whether an agent is signed in; undefined for agents with none. */
function signInReading(
  agent: string,
  usage: RateLimitState
): ProviderRateLimits | null | undefined {
  switch (agent) {
    case 'codex':
      return usage.codex
    case 'kimi':
      return usage.kimi
    case 'grok':
      return usage.grok
    case 'cursor':
      return usage.cursor
    case 'muse':
      return usage.muse
    default:
      return undefined
  }
}

/**
 * Whether an agent is signed in on the host, from what its usage reading proves. Null where
 * nothing does: no reading yet, or an agent Orca reads no usage for (Pi, OpenCode, Copilot…).
 */
export function agentSignedIn(
  agent: string,
  usage: RateLimitState | null,
  accounts: ProviderAccountsSnapshot | null
): boolean | null {
  if (!usage) {
    return null
  }
  if (
    (agent === 'codex' && codexHostAccountLabel(accounts)) ||
    (agent === 'grok' && usage.grokAuthConfigured) ||
    (agent === 'cursor' && usage.cursorAuthConfigured)
  ) {
    return true
  }
  // Only a reading that says signed out counts; a missing or pending one proves nothing.
  const status = signInReading(agent, usage)?.status
  return status === undefined || status === 'fetching' ? null : status !== 'unavailable'
}

/** Agents worth offering: installed and not known to be signed out; a working login needs no CLI. */
export function offeredAgent(installed: boolean | null, signedIn: boolean | null): boolean {
  return signedIn === true || (installed !== false && signedIn !== false)
}

export type SwitchFilter = {
  agent: string
  agents: readonly string[]
  usage: RateLimitState | null
  accounts: ProviderAccountsSnapshot | null
  /** The host's CLI inventory (Settings > Agents): false when absent, null while it loads. */
  installed?: (agent: string) => boolean | null
  /** Lists every agent, hidden ones included. */
  showAll?: boolean
}

/** The non-Claude agents to list, whether Claude's bare row hides, and how many were left out. */
export function offeredSwitchAgents(
  input: SwitchFilter,
  /** Saved Claude accounts keep the Claude group as it is. */
  claudeHasAccounts: boolean
): { otherAgents: string[]; claudeHidden: boolean; hiddenCount: number } {
  const offered = (other: string): boolean =>
    other === input.agent ||
    offeredAgent(
      input.installed?.(other) ?? null,
      agentSignedIn(other, input.usage, input.accounts)
    )
  const candidates = [...new Set([...input.agents, input.agent])].filter(
    (other) => other !== 'claude'
  )
  const otherAgents = input.showAll ? candidates : candidates.filter(offered)
  const claudeHidden =
    !input.showAll && !claudeHasAccounts && input.agents.includes('claude') && !offered('claude')
  return {
    otherAgents,
    claudeHidden,
    hiddenCount: candidates.length - otherAgents.length + (claudeHidden ? 1 : 0)
  }
}
