import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getProjectHostSetupProjectionFromState } from '@/store/projects/project-host-setup-selector'
import { getRepoRunHostProjectId } from '@/lib/workspace/creation/project-run-host'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { getEffectiveRunHostId } from '../../../../../shared/execution-host/project-run-host-preference'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { ResourceHostSummary } from './popover/resource-host-summary'
import {
  checkHeavyJobMove,
  executeHeavyJobMove,
  type HeavyMoveHost
} from './popover/resource-heavy-job-move'
import {
  pickHeavyJobRoutes,
  runHeavyJobRoute,
  setHeavyJobRouteNote,
  triedHeavyJobRoutes
} from './popover/resource-heavy-job-route'

function executionHostIdOf(cardId: string): ExecutionHostId {
  return cardId === 'local' ? LOCAL_EXECUTION_HOST_ID : toRuntimeExecutionHostId(cardId)
}

/**
 * Moves waiting heavy jobs to the project's (or the global) "Run on" host, once per job.
 * Runs off the Resource Manager's host samples, so it acts while those are polled.
 */
export function useHeavyJobAutoRouter(
  hostSummaries: readonly ResourceHostSummary[],
  repos: readonly Repo[],
  worktrees: readonly Worktree[]
): void {
  const settings = useAppStore((s) => s.settings)
  const projectHostSetups = useAppStore((s) => getProjectHostSetupProjectionFromState(s).setups)

  useEffect(() => {
    const hosts: HeavyMoveHost[] = hostSummaries.flatMap((host) =>
      host.machine?.heavyQueue
        ? [{ id: host.id, label: host.label, queue: host.machine.heavyQueue }]
        : []
    )
    if (hosts.length < 2 || (!settings?.heavyRunHostDefault && !settings?.projectRunHostIds)) {
      return
    }
    const executionHostIds = hosts.map((host) => executionHostIdOf(host.id))
    const routes = pickHeavyJobRoutes(hosts, triedHeavyJobRoutes, (host, job) => {
      const worktreeId = job.workspace?.worktreeId
      const hostId = executionHostIdOf(host.id)
      // Why the host check: the same worktree id can exist on two hosts.
      const worktree = worktreeId
        ? worktrees.find((row) => row.id === worktreeId && (!row.hostId || row.hostId === hostId))
        : undefined
      const repo = worktree ? repos.find((row) => row.id === worktree.repoId) : undefined
      if (!worktree || !repo) {
        return null
      }
      const projectId = getRepoRunHostProjectId(repo, projectHostSetups)
      const preferred = getEffectiveRunHostId(settings, projectId, executionHostIds)
      const index = preferred ? executionHostIds.indexOf(preferred.hostId) : -1
      return index === -1 ? null : hosts[index].id
    })
    for (const route of routes) {
      void runHeavyJobRoute(route, triedHeavyJobRoutes, {
        check: checkHeavyJobMove,
        execute: executeHeavyJobMove,
        note: setHeavyJobRouteNote,
        errorText: (error) => extractIpcErrorMessage(error, '')
      })
    }
  }, [hostSummaries, repos, worktrees, settings, projectHostSetups])
}
