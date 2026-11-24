import type { AgentSessionStatusSummary } from '../../../../../shared/agent-session/agent-session-wire'
import { AGENT_CHAT_SYSTEM_ACCOUNT } from '../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { AgentRowState } from '../../../../../shared/agent-status/presentation/agent-row-decay-state'
import type { CodexRestartNotice } from '@/store/terminals/terminal-contracts'
import { agentChildWorkLiveness } from '../../../../../shared/agent-status/child-work/agent-status-child-work-liveness'
import { usageAccountIdentity } from '../composition/usage-account-memory'

/** The chip key a System default login carries (see getOwnerUsageAccounts). */
export const SYSTEM_DEFAULT_USAGE_ACCOUNT_KEY = 'system-default'
/** Finished agents stay listed this long, so a just-ended turn is still findable. */
export const RECENT_SESSION_WINDOW_MS = 60 * 60_000

export type UsageSessionProvider = 'claude' | 'codex'
export type UsageSessionState = 'waiting' | 'working' | 'recent'

/** Which of the owner's accounts an agent bills: the host's selection, or one named account. */
export type UsageAccountRef = { kind: 'selected' } | { kind: 'account'; key: string }

export type UsageSessionOpenTarget =
  | { kind: 'pane'; worktreeId: string; tabId: string; paneKey: string }
  | { kind: 'chat'; workspaceId: string; sessionId: string }

export type UsageAgentSession = {
  key: string
  provider: UsageSessionProvider
  account: UsageAccountRef
  state: UsageSessionState
  title: string
  workspaceId: string
  /** When the shown state began; for recent ones, when the agent last changed. */
  since: number
  model?: string
  open: UsageSessionOpenTarget
  /** Set on another host's agents: where it runs, and the login it bills (provider and email). */
  elsewhere?: { environmentId: string | null; label: string; identity: string }
}

/** One host's account list, as getOwnerUsageAccounts gives it. */
export type UsageHostAccounts = Partial<
  Record<string, readonly { key: string; selected: boolean; name: { email?: string | null } }[]>
>

/**
 * Another host's agents, named by the login they bill. Local ids differ per host, so only the
 * provider's email ties an agent to a chip; an agent whose login has no known email is left out.
 */
export function identifyHostSessions(
  sessions: readonly UsageAgentSession[],
  accounts: UsageHostAccounts,
  host: { environmentId: string | null; label: string }
): UsageAgentSession[] {
  return sessions.flatMap((session) => {
    const entries = accounts[session.provider] ?? []
    const { account } = session
    const entry =
      account.kind === 'selected'
        ? entries.find((candidate) => candidate.selected)
        : entries.find((candidate) => candidate.key === account.key)
    const identity = usageAccountIdentity(session.provider, entry?.name.email)
    return identity ? [{ ...session, elsewhere: { ...host, identity } }] : []
  })
}

const STATE_ORDER: Record<UsageSessionState, number> = { waiting: 0, working: 1, recent: 2 }

function usageProvider(agent: string | undefined): UsageSessionProvider | null {
  return agent === 'claude' || agent === 'codex' ? agent : null
}

/** A chat's own account pick; absent follows the host's selection (`claudeChatAccountId`). */
export function chatAccountRef(accountChoice: string | undefined): UsageAccountRef {
  if (!accountChoice) {
    return { kind: 'selected' }
  }
  return {
    kind: 'account',
    key:
      accountChoice === AGENT_CHAT_SYSTEM_ACCOUNT ? SYSTEM_DEFAULT_USAGE_ACCOUNT_KEY : accountChoice
  }
}

/**
 * A terminal agent runs on the selection it launched under. After a switch, a pane still waiting
 * on its restart prompt keeps the account it launched on; any other follows the selection.
 */
export function terminalAccountRef(notice: CodexRestartNotice | undefined): UsageAccountRef {
  if (
    !notice ||
    notice.dismissed ||
    notice.restartRequested ||
    notice.previousAccountId === undefined
  ) {
    return { kind: 'selected' }
  }
  return { kind: 'account', key: notice.previousAccountId ?? SYSTEM_DEFAULT_USAGE_ACCOUNT_KEY }
}

export type UsageChatInput = Pick<
  AgentSessionStatusSummary,
  | 'sessionId'
  | 'workspaceId'
  | 'agent'
  | 'status'
  | 'awaitsAnswer'
  | 'statusStartedAt'
  | 'updatedAt'
  | 'model'
  | 'accountChoice'
  | 'children'
  | 'backgroundTasks'
> & { title: string }

export function collectChatSessions(
  chats: Iterable<UsageChatInput>,
  now: number
): UsageAgentSession[] {
  const sessions: UsageAgentSession[] = []
  for (const chat of chats) {
    const provider = usageProvider(chat.agent)
    if (!provider || chat.status === null) {
      continue
    }
    // Why child work counts: a worker that ended its turn while CI, a monitor or a subagent runs is
    // still working, as the sidebar shows it.
    const childWork = agentChildWorkLiveness(chat.children ?? chat.backgroundTasks)
    const state: UsageSessionState | null =
      chat.status === 'attention' || chat.awaitsAnswer || childWork === 'waiting'
        ? 'waiting'
        : chat.status === 'working' || childWork !== null
          ? 'working'
          : now - chat.updatedAt <= RECENT_SESSION_WINDOW_MS
            ? 'recent'
            : null
    if (!state) {
      continue
    }
    sessions.push({
      key: `chat:${chat.sessionId}`,
      provider,
      account: chatAccountRef(chat.accountChoice),
      state,
      title: chat.title,
      workspaceId: chat.workspaceId,
      since: state === 'recent' ? chat.updatedAt : (chat.statusStartedAt ?? chat.updatedAt),
      ...(chat.model ? { model: chat.model } : {}),
      open: { kind: 'chat', workspaceId: chat.workspaceId, sessionId: chat.sessionId }
    })
  }
  return sessions
}

export type UsageTerminalInput = {
  paneKey: string
  tabId: string
  worktreeId: string
  agentType: string | undefined
  /** The sidebar's resolved state: stale rows have already decayed. */
  rowState: AgentRowState
  stateStartedAt: number
  updatedAt: number
  title: string
  model?: string
  restartNotice?: CodexRestartNotice
}

export function collectTerminalSessions(
  rows: Iterable<UsageTerminalInput>,
  now: number
): UsageAgentSession[] {
  const sessions: UsageAgentSession[] = []
  for (const row of rows) {
    const provider = usageProvider(row.agentType)
    if (!provider) {
      continue
    }
    // Why unverifiable is left out: a silent pane may have stopped, and a guess would spin forever.
    const state: UsageSessionState | null =
      row.rowState === 'working'
        ? 'working'
        : row.rowState === 'blocked' || row.rowState === 'waiting'
          ? 'waiting'
          : (row.rowState === 'done' || row.rowState === 'idle') &&
              now - row.updatedAt <= RECENT_SESSION_WINDOW_MS
            ? 'recent'
            : null
    if (!state) {
      continue
    }
    sessions.push({
      key: `pane:${row.paneKey}`,
      provider,
      account: terminalAccountRef(row.restartNotice),
      state,
      title: row.title,
      workspaceId: row.worktreeId,
      since: state === 'recent' ? row.updatedAt : row.stateStartedAt,
      ...(row.model ? { model: row.model } : {}),
      open: { kind: 'pane', worktreeId: row.worktreeId, tabId: row.tabId, paneKey: row.paneKey }
    })
  }
  return sessions
}

/** What a usage chip or row stands for: a whole provider, or one of its accounts. */
export type UsageSessionScope = {
  provider: string
  /** Absent: the chip stands for the whole provider. */
  accountKey?: string
  /** The account the owning host has selected. */
  selected?: boolean
  /** The chip's login (provider and email), which another host's agents match on. */
  accountIdentity?: string
}

export function sessionsInScope(
  sessions: readonly UsageAgentSession[],
  scope: UsageSessionScope
): UsageAgentSession[] {
  return sessions
    .filter(
      (session) =>
        session.provider === scope.provider &&
        (session.elsewhere
          ? session.elsewhere.identity === scope.accountIdentity
          : scope.accountKey === undefined ||
            (session.account.kind === 'selected'
              ? scope.selected === true
              : session.account.key === scope.accountKey))
    )
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.since - a.since)
}

export function countSessionStates(sessions: readonly UsageAgentSession[]): {
  working: number
  waiting: number
  recent: number
} {
  const counts = { working: 0, waiting: 0, recent: 0 }
  for (const session of sessions) {
    counts[session.state] += 1
  }
  return counts
}

/** Groups keep the order of their first session, so the most urgent workspace leads. */
export function groupSessionsByWorkspace(
  sessions: readonly UsageAgentSession[]
): { workspaceId: string; sessions: UsageAgentSession[] }[] {
  const groups = new Map<string, UsageAgentSession[]>()
  for (const session of sessions) {
    const group = groups.get(session.workspaceId)
    if (group) {
      group.push(session)
    } else {
      groups.set(session.workspaceId, [session])
    }
  }
  return [...groups].map(([workspaceId, items]) => ({ workspaceId, sessions: items }))
}
