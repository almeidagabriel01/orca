import type {
  MemorySnapshot,
  SessionMemory,
  WorktreeMemory
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { PtyListedSession } from '../../../../../../shared/terminal/pty/lifecycle/pty-listed-session'
import { isProgramStatusRow } from '../../../../../../shared/program-status/program-status-row'
import { useAppStore } from '../../../../store/index'

export type ResourceOwnerUsage = { memory: number }

/** Orca's tracked memory by who started it, so no single total reads as Orca's own usage. */
export type ResourceOwnerSplit = {
  orca: ResourceOwnerUsage
  agents: ResourceOwnerUsage
  yourProcesses: ResourceOwnerUsage
}

type DaemonSessionFacts = Pick<PtyListedSession, 'id' | 'paneKey' | 'agentOwnership'>

export type PaneActivityReader = {
  has(paneKey: string): boolean
  isRunningCommand(paneKey: string): boolean
}

export function isAgentSessionSample(
  session: Pick<SessionMemory, 'paneKey'>,
  daemon: DaemonSessionFacts | undefined,
  agentPaneKeys: Pick<PaneActivityReader, 'has'>
): boolean {
  // Why: boot-hydrated samples carry no pane key; the daemon's binding still does.
  const paneKey = session.paneKey ?? daemon?.paneKey ?? null
  // Why: the daemon proves only claimed agents present, so its 'absent' never rules out a hook-reported one.
  return daemon?.agentOwnership === 'present' || (paneKey !== null && agentPaneKeys.has(paneKey))
}

/** The snapshot is this machine only, so SSH and paired-server sessions never enter the split. */
export function splitSnapshotByOwner(
  snapshot: MemorySnapshot,
  daemonSessions: readonly DaemonSessionFacts[],
  agentPaneKeys: Pick<PaneActivityReader, 'has'>
): ResourceOwnerSplit {
  const daemonById = new Map(daemonSessions.map((session) => [session.id, session]))
  // Chat agents run outside terminals, so they have no session row of their own.
  const agents = { memory: snapshot.agentProcesses?.memory ?? 0 }
  const yourProcesses = { memory: 0 }
  for (const worktree of snapshot.worktrees) {
    for (const session of worktree.sessions) {
      const isAgent = isAgentSessionSample(
        session,
        daemonById.get(session.sessionId),
        agentPaneKeys
      )
      ;(isAgent ? agents : yourProcesses).memory += session.memory
    }
  }
  return { orca: { memory: snapshot.app.memory }, agents, yourProcesses }
}

/** Agent processes no listed chat row accounts for, such as a server several chats share. */
export function sharedAgentProcessUsage(
  snapshot: MemorySnapshot,
  isListed: (worktree: WorktreeMemory) => boolean
): { cpu: number; memory: number } | null {
  const total = snapshot.agentProcesses
  if (!total || total.memory <= 0) {
    return null
  }
  let cpu = total.cpu
  let memory = total.memory
  for (const worktree of snapshot.worktrees) {
    if (!worktree.chats || !isListed(worktree)) {
      continue
    }
    for (const chat of worktree.chats) {
      cpu -= chat.cpu
      memory -= chat.memory
    }
  }
  return memory > 0 ? { cpu: Math.max(0, cpu), memory } : null
}

/** Panes with a real agent, and panes running a reported program (a finished one's kept row is neither). */
export function readAgentPaneKeys(): PaneActivityReader {
  const statuses = useAppStore.getState().agentStatusByPaneKey
  return {
    has: (paneKey) => {
      const entry = statuses.get(paneKey)
      return entry !== undefined && !isProgramStatusRow(entry)
    },
    isRunningCommand: (paneKey) => {
      const entry = statuses.get(paneKey)
      return entry !== undefined && isProgramStatusRow(entry) && entry.state !== 'done'
    }
  }
}
