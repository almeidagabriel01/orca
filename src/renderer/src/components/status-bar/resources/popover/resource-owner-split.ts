import type {
  MemorySnapshot,
  SessionMemory
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
  const agents = { memory: 0 }
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
