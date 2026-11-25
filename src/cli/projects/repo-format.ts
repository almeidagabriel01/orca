import { branchRefLabels } from '../../shared/git/refs/branch-ref-label'
import { normalizeProjectAgentLaunchDefaults } from '../../shared/agent-launch/choices/project-agent-launch-defaults'
import type {
  RuntimeRepoList,
  RuntimeRepoSearchRefs
} from '../../shared/worktree/catalog/runtime-worktree-contracts'

export function formatRepoList(result: RuntimeRepoList): string {
  if (result.repos.length === 0) {
    return 'No repos found.'
  }
  return result.repos
    .map(
      (repo) =>
        `${repo.id}  ${repo.displayName}  ${repo.path}${typeof repo.hiddenAt === 'number' ? '  (hidden)' : ''}`
    )
    .join('\n')
}

/** Unset fields follow the host's own agent defaults. */
function formatAgentLaunchDefaults(value: unknown): string {
  const defaults = normalizeProjectAgentLaunchDefaults(value)
  const agents = new Map<string, string[]>()
  for (const [agent, choice] of Object.entries(defaults?.agentLaunchChoices ?? {})) {
    agents.set(agent, [
      ...(choice.model ? [`model=${choice.model}`] : []),
      ...Object.entries(choice.options ?? {}).map(([key, option]) => `${key}=${option}`)
    ])
  }
  for (const [agent, account] of Object.entries(defaults?.agentAccounts ?? {})) {
    agents.set(agent, [...(agents.get(agent) ?? []), `account=${account}`])
  }
  return [
    'agentDefaults:',
    `  agent: ${defaults?.defaultTuiAgent ?? 'inherit'}`,
    `  surface: ${defaults?.defaultSurface ?? 'inherit'}`,
    ...[...agents].map(([agent, parts]) => `  ${agent}: ${parts.join(' ')}`)
  ].join('\n')
}

export function formatRepoShow(result: { repo: Record<string, unknown> }): string {
  return [
    ...Object.entries(result.repo)
      .filter(([key]) => key !== 'agentLaunchDefaults')
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`
      ),
    formatAgentLaunchDefaults(result.repo.agentLaunchDefaults)
  ].join('\n')
}

export function formatRepoRefs(result: RuntimeRepoSearchRefs): string {
  if (result.refs.length === 0) {
    return 'No refs found.'
  }
  const labels = branchRefLabels(result.refs)
  const text = result.refs.map((ref) => labels.get(ref) ?? ref).join('\n')
  return result.truncated ? `${text}\n\ntruncated: yes` : text
}
