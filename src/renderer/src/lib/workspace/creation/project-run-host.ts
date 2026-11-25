import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { ProjectHostSetup } from '../../../../../shared/project/project-types'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { translateHostDisplayLabel } from '@/runtime/hosts/display/execution-host-label'
import type { Translate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { getRepoWorkspaceCreationTargetHint } from './project-host-workspace-target'

export type ProjectRunHostOption = { hostId: ExecutionHostId; label: string }

type RunHostCandidate = { id: ExecutionHostId; label: string; isDefaultLocalLabel?: boolean }

/** The project's ready hosts this client can reach, one per host; "Run on" shows only with 2+. */
export function getProjectRunHostOptions(
  projectId: string,
  projectHostSetups: readonly ProjectHostSetup[],
  hosts: readonly RunHostCandidate[],
  t: Translate
): ProjectRunHostOption[] {
  const hostById = new Map(hosts.map((host) => [host.id, host]))
  const options = new Map<ExecutionHostId, ProjectRunHostOption>()
  for (const setup of projectHostSetups) {
    const host = hostById.get(setup.hostId)
    if (
      setup.projectId === projectId &&
      setup.setupState === 'ready' &&
      setup.repoId.trim() &&
      host &&
      !options.has(setup.hostId)
    ) {
      options.set(setup.hostId, { hostId: setup.hostId, label: translateHostDisplayLabel(host, t) })
    }
  }
  return [...options.values()]
}

/** Same key the creation resolver reads: the setup's project id, shared by every host copy. */
export function getRepoRunHostProjectId(
  repo: Repo,
  projectHostSetups: readonly ProjectHostSetup[]
): string {
  return getRepoWorkspaceCreationTargetHint(repo, projectHostSetups).projectId
}

export function setProjectRunHost(projectId: string, hostId: ExecutionHostId): void {
  const { settings, updateSettings } = useAppStore.getState()
  void updateSettings({
    projectRunHostIds: { ...settings?.projectRunHostIds, [projectId]: hostId }
  })
}
