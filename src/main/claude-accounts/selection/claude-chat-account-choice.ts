import {
  AGENT_CHAT_SYSTEM_ACCOUNT,
  agentSupportsChatAccountChoice
} from '../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { projectAgentAccountChoice } from '../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { getRepoIdFromWorktreeId } from '../../../shared/worktree/id'
import type { Repo } from '../../../shared/repository/repo-types'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type { ClaudeProfileRouter } from '../profiles/routing/claude-profile-router'
import { getClaudeProfileRouter } from '../profiles/routing/claude-profile-installed-router'
import { CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE } from '../profiles/routing/claude-profile-launch-errors'
import { CLAUDE_ACCOUNT_NEEDS_SIGN_IN_MESSAGE } from './claude-account-selection'

/** Why a chat can't run on `choice` on this host, or null when it can. A chat only chooses among
 *  this host's own accounts: a WSL account can't run a native chat. */
export function claudeChatAccountChoiceProblem(
  router:
    | Pick<ClaudeProfileRouter, 'savedAccount' | 'accountLogin' | 'coveredBySystemDefault'>
    | undefined,
  choice: string
): string | null {
  if (choice === AGENT_CHAT_SYSTEM_ACCOUNT) {
    return null
  }
  const saved = router?.savedAccount(choice)
  if (!router || !saved || saved.managedAuthRuntime === 'wsl') {
    return CLAUDE_CHAT_ACCOUNT_MISSING_MESSAGE
  }
  return router.accountLogin(choice) || router.coveredBySystemDefault(choice)
    ? null
    : CLAUDE_ACCOUNT_NEEDS_SIGN_IN_MESSAGE
}

/** A saved default `choice` a new chat of `agent` can start on here; a removed or signed-out account
 *  falls back to the host's selection instead of refusing every chat. */
export function usableChatAccountChoice(
  agent: string,
  choice: string | undefined
): string | undefined {
  return choice &&
    agentSupportsChatAccountChoice(agent) &&
    !claudeChatAccountChoiceProblem(getClaudeProfileRouter(), choice)
    ? choice
    : undefined
}

/** The account a new Claude launch in this project starts on: its usable default, else none. */
export function projectClaudeAccountChoice(
  repo: Pick<Repo, 'agentLaunchDefaults'> | null | undefined,
  agent = 'claude'
): string | undefined {
  return usableChatAccountChoice(agent, projectAgentAccountChoice(repo, agent))
}

export type ProjectRepoLookup = {
  getRepo(id: string): Pick<Repo, 'agentLaunchDefaults'> | undefined
}

/** `projectClaudeAccountChoice` for a terminal, which knows only its worktree id. */
export function projectClaudeAccountChoiceForWorktree(
  store: ProjectRepoLookup | undefined,
  worktreeId: string | undefined,
  agent = 'claude'
): string | undefined {
  return worktreeId && store
    ? projectClaudeAccountChoice(store.getRepo(getRepoIdFromWorktreeId(worktreeId)), agent)
    : undefined
}

/** The account a chat launches on now: its own pick, else its project's default, else the host's.
 *  Read at each launch, so chats saved without an account follow a default set later. */
export function chatLaunchAccountChoice(
  store: ProjectRepoLookup | undefined,
  record: Pick<AgentSessionRecord, 'accountChoice' | 'provider' | 'location'>
): string | undefined {
  return (
    record.accountChoice ??
    projectClaudeAccountChoiceForWorktree(store, record.location.workspaceId, record.provider)
  )
}
