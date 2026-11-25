import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRuntimeStatusByEnvironmentId } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import { getResolvedExecutionHostIdForWorktree } from '@/lib/workspace/ownership/resolved-worktree-execution-host'
import { buildProjectHostSetupOptions } from '@/lib/workspace/creation/project-host-setup-options'
import { getHostHealthUnavailableDetail } from '@/lib/workspace/creation/project-host-health-detail'
import {
  buildHandoffDestinations,
  type HandoffDestination
} from '@/lib/agent-session/launch/continuation/handoff-destinations'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { getNewWorkspaceDialogEligibleRepos } from '../../../../shared/new-workspace/new-workspace-dialog-repo'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host/execution-host-registry'
import { getHostDisplayLabelOverrides } from '../../../../shared/execution-host/host-setting-overrides'
import { isFolderRepo } from '../../../../shared/repository/repo-kind'

/** Where a chat in this workspace can be handed off: here, or the project's workspaces on other hosts. */
export function useHandoffDestinations(
  worktreeId: string | undefined,
  executionHostId?: ExecutionHostId
): HandoffDestination[] | null {
  // Ids can exist on two hosts; the host picks the copy (default: the focused one).
  const source = useAppStore((state) =>
    worktreeId ? findWorktreeById(state, worktreeId, executionHostId) : null
  )
  const sourceHostId = useAppStore((state) =>
    executionHostId && source
      ? executionHostId
      : getResolvedExecutionHostIdForWorktree(state, worktreeId)
  )
  const repos = useAppStore((state) => state.repos)
  const settings = useAppStore((state) => state.settings)
  const projectHostSetups = useAppStore((state) => state.projectHostSetups)
  const worktreesByRepo = useAppStore((state) => selectWorktreesByRepo(state))
  const sshConnectionStates = useAppStore((state) => state.sshConnectionStates)
  const sshTargetLabels = useAppStore((state) => state.sshTargetLabels)
  const runtimeEnvironments = useAppStore((state) => state.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useRuntimeStatusByEnvironmentId()

  return useMemo(() => {
    if (!source || !sourceHostId) {
      return null
    }
    const sourceRepo = repos.find((repo) => repo.id === source.repoId)
    const projectId =
      source.projectId ??
      projectHostSetups.find((setup) => setup.repoId === source.repoId)?.projectId ??
      null
    const hosts = buildExecutionHostRegistry({
      repos,
      settings,
      hostSource: 'configured-only',
      sshTargetLabels,
      sshConnectionStates,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId,
      hostLabelOverrides: getHostDisplayLabelOverrides(settings)
    })
    return buildHandoffDestinations({
      source,
      sourceHostId,
      sourceIsFolder: sourceRepo ? isFolderRepo(sourceRepo) : false,
      hostOptions: buildProjectHostSetupOptions({
        projectId,
        projectHostSetups,
        eligibleRepos: getNewWorkspaceDialogEligibleRepos(repos),
        hosts
      }),
      hosts,
      worktreesByRepo,
      hostUnavailableDetail: (host) => getHostHealthUnavailableDetail(host.health)
    })
  }, [
    source,
    sourceHostId,
    repos,
    settings,
    projectHostSetups,
    worktreesByRepo,
    sshConnectionStates,
    sshTargetLabels,
    runtimeEnvironments,
    runtimeStatusByEnvironmentId
  ])
}
