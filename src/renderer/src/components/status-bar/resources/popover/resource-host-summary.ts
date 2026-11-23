import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type {
  UsageValues,
  WorktreeMemory
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { PtyListedSession } from '../../../../../../shared/terminal/pty/lifecycle/pty-listed-session'
import {
  getRuntimeHostResourceNotice,
  parseHostMachineTotals,
  type HostMachineTotals,
  type RuntimeHostResourceResult
} from '../../host-connections/runtime-host-resources'
import { isAgentSessionSample, type PaneActivityReader } from './resource-owner-split'

export type ResourceHostCounts = { terminals: number; agents: number; commands: number }

/** One machine's own numbers; hosts are never summed since each may measure memory differently. */
export type ResourceHostSummary = {
  id: string
  label: string
  isLocal: boolean
  /** Orca's own processes on that host; null when the host does not report them. */
  orca: UsageValues | null
  /** The whole machine; null when the host could not be sampled. */
  machine: HostMachineTotals | null
  /** Null when the host could not be sampled; notice says why. */
  counts: ResourceHostCounts | null
  notice: string | null
}

type DaemonSessionFacts = Pick<PtyListedSession, 'id' | 'paneKey' | 'agentOwnership'>

function countHostSessions(
  worktrees: readonly WorktreeMemory[],
  daemonById: ReadonlyMap<string, DaemonSessionFacts>,
  panes: PaneActivityReader
): ResourceHostCounts {
  const counts = { terminals: 0, agents: 0, commands: 0 }
  for (const worktree of worktrees) {
    for (const session of worktree.sessions) {
      counts.terminals++
      const daemon = daemonById.get(session.sessionId)
      const paneKey = session.paneKey ?? daemon?.paneKey ?? null
      if (isAgentSessionSample(session, daemon, panes)) {
        counts.agents++
      } else if (paneKey !== null && panes.isRunningCommand(paneKey)) {
        counts.commands++
      }
    }
  }
  return counts
}

export function buildResourceHostSummaries(
  {
    localSnapshot,
    localDaemonSessions,
    runtimeResults,
    runtimeHostLabel,
    panes
  }: {
    localSnapshot: {
      app: UsageValues
      worktrees: readonly WorktreeMemory[]
      host: unknown
    } | null
    localDaemonSessions: readonly DaemonSessionFacts[]
    runtimeResults: Readonly<Record<string, RuntimeHostResourceResult>>
    runtimeHostLabel: (environmentId: string) => string
    panes: PaneActivityReader
  },
  t: Translate = translate
): ResourceHostSummary[] {
  const hosts: ResourceHostSummary[] = []
  if (localSnapshot) {
    hosts.push({
      id: 'local',
      label: t('resourceManager.hosts.local', 'This computer'),
      isLocal: true,
      orca: { cpu: localSnapshot.app.cpu, memory: localSnapshot.app.memory },
      machine: parseHostMachineTotals(localSnapshot.host),
      counts: countHostSessions(
        localSnapshot.worktrees,
        new Map(localDaemonSessions.map((session) => [session.id, session])),
        panes
      ),
      notice: null
    })
  }
  const environmentIds = Object.keys(runtimeResults).sort()
  for (const environmentId of environmentIds) {
    const result = runtimeResults[environmentId]
    const label = runtimeHostLabel(environmentId)
    hosts.push({
      id: environmentId,
      label,
      isLocal: false,
      orca: result.status === 'sampled' ? result.app : null,
      machine: result.status === 'sampled' ? result.machine : null,
      // Why: paired-server sessions have no local daemon row; mirrored pane statuses classify them.
      counts:
        result.status === 'sampled' ? countHostSessions(result.worktrees, new Map(), panes) : null,
      notice: getRuntimeHostResourceNotice(result, label, t)
    })
  }
  return hosts
}
