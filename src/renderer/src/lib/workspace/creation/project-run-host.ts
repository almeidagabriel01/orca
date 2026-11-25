import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type { ProjectHostSetup } from '../../../../../shared/project/project-types'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { translateHostDisplayLabel } from '@/runtime/hosts/display/execution-host-label'
import { useMemo } from 'react'
import type { Translate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { getRepoWorkspaceCreationTargetHint } from './project-host-workspace-target'
import { useRuntimeStatusByEnvironmentId } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { buildHeavyRunHostRegistry } from '../../../../../shared/execution-host/heavy-run-hosts'
import type { ExecutionHostRegistryEntry } from '../../../../../shared/execution-host/execution-host-registry-entry'
import { getHostDisplayLabelOverrides } from '../../../../../shared/execution-host/host-setting-overrides'

/** Choice value meaning "no host saved" (global default / Automatic); never a host id. */
export const RUN_HOST_DEFAULT_VALUE = '__default__'

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

/** Hosts that run the heavy queue: this computer and paired Orca servers, never SSH aliases. */
export function useRunHostCandidates(): ExecutionHostRegistryEntry[] {
  const repos = useAppStore((state) => state.repos)
  const settings = useAppStore((state) => state.settings)
  const sshTargetLabels = useAppStore((state) => state.sshTargetLabels)
  const sshConnectionStates = useAppStore((state) => state.sshConnectionStates)
  const runtimeEnvironments = useAppStore((state) => state.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useRuntimeStatusByEnvironmentId()
  return useMemo(
    () =>
      buildHeavyRunHostRegistry({
        repos,
        settings,
        hostSource: 'configured-only',
        sshTargetLabels,
        sshConnectionStates,
        runtimeEnvironments,
        runtimeStatusByEnvironmentId,
        hostLabelOverrides: getHostDisplayLabelOverrides(settings)
      }),
    [
      repos,
      settings,
      sshTargetLabels,
      sshConnectionStates,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId
    ]
  )
}

/** Label of the global "Run heavy work on" host, or "Automatic" when unset. */
export function getGlobalRunHostLabel(
  hostId: ExecutionHostId | null | undefined,
  hosts: readonly RunHostCandidate[],
  t: Translate
): string {
  const host = hostId ? hosts.find((candidate) => candidate.id === hostId) : undefined
  // A saved host off the list (an old ssh alias) falls back to Automatic, as routing does.
  return host
    ? translateHostDisplayLabel(host, t)
    : t('settings.heavyRunHostDefault.automatic', 'Automatic')
}

/** null clears the project's choice so it follows the global default again. */
export function setProjectRunHost(projectId: string, hostId: ExecutionHostId | null): void {
  const { settings, updateSettings } = useAppStore.getState()
  const { [projectId]: _previous, ...rest } = settings?.projectRunHostIds ?? {}
  void updateSettings({ projectRunHostIds: hostId ? { ...rest, [projectId]: hostId } : rest })
}

export function setHeavyRunHostDefault(hostId: ExecutionHostId | null): void {
  void useAppStore.getState().updateSettings({ heavyRunHostDefault: hostId })
}

/** A saved host no longer in the list (e.g. an SSH alias saved by fork.2): its name, else null. */
export function getStaleRunHostName(
  value: ExecutionHostId | null,
  options: readonly { hostId: ExecutionHostId }[]
): string | null {
  if (!value || options.some((option) => option.hostId === value)) {
    return null
  }
  const parsed = parseExecutionHostId(value)
  return parsed?.kind === 'ssh'
    ? parsed.targetId
    : parsed?.kind === 'runtime'
      ? parsed.environmentId
      : value
}
