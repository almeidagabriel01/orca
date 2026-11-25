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
import {
  getEffectiveRunHostId,
  hasRunHostPreference
} from '../../../../../shared/execution-host/project-run-host-preference'
import { folderWorkspaceToWorktree } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '../../../store/workspaces/catalog/workspace-record-fields'
import { getIndexedAllWorktrees } from '../../../store/slices/worktrees/listing/worktree-catalog-index'
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
 * Repos and worktrees are read when the queues arrive, so no store churn reruns it.
 */
export function useHeavyJobAutoRouter(hosts: readonly HeavyMoveHost[]): void {
  const settings = useAppStore((s) => s.settings)

  useEffect(() => {
    if (hosts.length < 2 || !hasRunHostPreference(settings)) {
      return
    }
    const state = useAppStore.getState()
    const projectHostSetups = getProjectHostSetupProjectionFromState(state).setups
    const repos = state.repos
    const worktrees = [
      ...getIndexedAllWorktrees(selectWorktreesByRepo(state)),
      ...selectFolderWorkspaces(state).map(folderWorkspaceToWorktree)
    ]
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
  }, [hosts, settings])
}
