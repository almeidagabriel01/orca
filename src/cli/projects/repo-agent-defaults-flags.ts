import type { HandlerContext } from '../dispatch/dispatch'
import { RuntimeClientError } from '../runtime/connection/types'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../arguments/flags'
import { resolveSavedAccountId } from '../accounts/account-selection'
import { isTuiAgent } from '../../shared/agent-launch/catalog/tui-agent-config'
import { reconcileAgentChoiceArgs } from '../../shared/agent-launch/choices/agent-choice-reconciliation'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'
import {
  normalizeAgentModelOptionChoices,
  type AgentLaunchChoices
} from '../../shared/agent-launch/choices/agent-launch-choices'
import {
  normalizeProjectAgentLaunchDefaults,
  type ProjectAgentLaunchDefaults
} from '../../shared/agent-launch/choices/project-agent-launch-defaults'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  AGENT_CHAT_SYSTEM_ACCOUNT
} from '../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { ClaudeRateLimitAccountsState } from '../../shared/agent-accounts/managed-account-types'
import { getManagedAccountLookupNames } from '../../shared/agent-accounts/managed-account-display-names'

export const REPO_AGENT_DEFAULT_FLAGS = [
  'default-agent',
  'default-surface',
  'default-model',
  'default-effort',
  'default-account'
] as const

/** null clears; '*' (bare `inherit`) targets every agent that has a saved choice. */
type AgentEntry = [agent: TuiAgent | '*', value: string | null]

export type RepoAgentDefaultsPatch = {
  agent?: ProjectAgentLaunchDefaults['defaultTuiAgent'] | null
  /** null clears. */
  surface?: ProjectAgentLaunchDefaults['defaultSurface'] | null
  models: AgentEntry[]
  efforts: AgentEntry[]
  /** The Claude account: an id or `system`; null clears. */
  account?: string | null
}

const clearing = (value: string): boolean => value === 'inherit'

function readAgentEntries(
  flags: HandlerContext['flags'],
  name: string,
  field: 'model' | 'effort'
): AgentEntry[] {
  return getRepeatedStringFlag(flags, name).map((entry): AgentEntry => {
    if (clearing(entry)) {
      return ['*', null]
    }
    const split = entry.indexOf('=')
    const agent = entry.slice(0, Math.max(split, 0))
    const value = entry.slice(split + 1).trim()
    if (split < 1 || !isTuiAgent(agent) || !value) {
      throw new RuntimeClientError(
        'invalid_argument',
        `--${name} takes <agent>=<value> or inherit (got "${entry}"); agents are the ids \`orca agent launch --agent\` takes.`
      )
    }
    if (clearing(value)) {
      return [agent, null]
    }
    // The host's normalizer drops what it can't launch with; refuse it here instead.
    const choice = field === 'model' ? { model: value } : { options: { effort: value } }
    if (!normalizeAgentModelOptionChoices(choice)) {
      throw new RuntimeClientError(
        'invalid_argument',
        `--${name}: "${value}" is not a valid ${field}.`
      )
    }
    return [agent, value]
  })
}

function readDefaultAgent(
  flags: HandlerContext['flags']
): ProjectAgentLaunchDefaults['defaultTuiAgent'] | null | undefined {
  const agent = getOptionalStringFlag(flags, 'default-agent')
  if (agent === undefined || agent === 'blank' || isTuiAgent(agent)) {
    return agent
  }
  if (clearing(agent)) {
    return null
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `--default-agent "${agent}" is not a known agent; pass an agent id, blank, or inherit.`
  )
}

function readDefaultSurface(
  flags: HandlerContext['flags']
): ProjectAgentLaunchDefaults['defaultSurface'] | null | undefined {
  const surface = getOptionalStringFlag(flags, 'default-surface')
  if (surface === undefined || surface === 'chat' || surface === 'terminal') {
    return surface
  }
  if (clearing(surface)) {
    return null
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `--default-surface "${surface}" is not valid; pass chat, terminal, or inherit.`
  )
}

/** Undefined when no agent-defaults flag was passed. */
export function readRepoAgentDefaultsPatch(
  flags: HandlerContext['flags']
): RepoAgentDefaultsPatch | undefined {
  if (!REPO_AGENT_DEFAULT_FLAGS.some((flag) => flags.has(flag))) {
    return undefined
  }
  return {
    agent: readDefaultAgent(flags),
    surface: readDefaultSurface(flags),
    models: readAgentEntries(flags, 'default-model', 'model'),
    efforts: readAgentEntries(flags, 'default-effort', 'effort'),
    account: getOptionalStringFlag(flags, 'default-account')
  }
}

/** `host` and `inherit` clear; anything else must be a saved Claude account on the repo's host. */
export async function resolveRepoDefaultAccount(
  client: HandlerContext['client'],
  value: string
): Promise<string | null> {
  if (clearing(value) || value === AGENT_CHAT_HOST_ACCOUNT) {
    return null
  }
  if (value === AGENT_CHAT_SYSTEM_ACCOUNT) {
    return value
  }
  const { claude } = (
    await client.call<{ claude: ClaudeRateLimitAccountsState }>('accounts.list', {
      refreshUsage: false
    })
  ).result
  // The Settings picker also hides needsSignIn rows; those stay saved accounts, so allow them.
  // WSL-managed logins can't run this host's chats.
  const accounts = claude.accounts.filter((account) => account.managedAuthRuntime !== 'wsl')
  return resolveSavedAccountId('Claude', getManagedAccountLookupNames(accounts), value)
}

/** The same edit the Settings model and effort pickers make, so a new model drops the old one's effort. */
function applyChoiceEntries(
  choices: AgentLaunchChoices,
  entries: AgentEntry[],
  field: 'model' | 'effort'
): void {
  for (const [agent, value] of entries) {
    const targets = agent === '*' ? Object.keys(choices).filter(isTuiAgent) : [agent]
    for (const target of targets) {
      const patch = field === 'model' ? { model: value } : { options: { effort: value } }
      choices[target] = reconcileAgentChoiceArgs({
        agent: target,
        choices: choices[target] ?? {},
        userArgs: '',
        mode: 'choice-edit',
        keys: new Set(['model', ...Object.keys(patch.options ?? {})]),
        patch
      }).choices
    }
  }
}

/** The whole record to save: the host replaces it, so every field the flags don't touch is kept. */
export function applyRepoAgentDefaultsPatch(
  current: unknown,
  patch: RepoAgentDefaultsPatch
): ProjectAgentLaunchDefaults | null {
  const base = normalizeProjectAgentLaunchDefaults(current) ?? {}
  const next: ProjectAgentLaunchDefaults = { ...base }
  if (patch.agent !== undefined) {
    next.defaultTuiAgent = patch.agent ?? undefined
  }
  if (patch.surface !== undefined) {
    next.defaultSurface = patch.surface ?? undefined
  }
  const choices: AgentLaunchChoices = { ...base.agentLaunchChoices }
  applyChoiceEntries(choices, patch.models, 'model')
  applyChoiceEntries(choices, patch.efforts, 'effort')
  next.agentLaunchChoices = choices
  if (patch.account !== undefined) {
    const accounts = { ...base.agentAccounts }
    if (patch.account === null) {
      delete accounts.claude
    } else {
      accounts.claude = patch.account
    }
    next.agentAccounts = accounts
  }
  return normalizeProjectAgentLaunchDefaults(next) ?? null
}
