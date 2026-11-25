import React from 'react'
import { Server } from 'lucide-react'
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { getProjectHostSetupProjectionFromState } from '@/store/projects/project-host-setup-selector'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import {
  getProjectRunHostOptions,
  getRepoRunHostProjectId,
  setProjectRunHost,
  type ProjectRunHostOption
} from '@/lib/workspace/creation/project-run-host'
import { useRuntimeStatusByEnvironmentId } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { buildExecutionHostRegistry } from '../../../../../../shared/execution-host/execution-host-registry'
import { getHostDisplayLabelOverrides } from '../../../../../../shared/execution-host/host-setting-overrides'

/** Presentational "Run on" radio list; renders nothing for a single-host project. */
export function ProjectRunHostRadioItems({
  options,
  value,
  onValueChange
}: {
  options: readonly ProjectRunHostOption[]
  value: ExecutionHostId | null
  onValueChange: (hostId: ExecutionHostId) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  if (options.length < 2) {
    return null
  }
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-1.5">
        <Server className="size-3.5" />
        {t('sidebar.projectRunHost.label', 'Run on')}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value ?? ''}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.hostId === next)
          if (option) {
            onValueChange(option.hostId)
          }
        }}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.hostId}
            value={option.hostId}
            // Keep the menu open so the new check is visible.
            onSelect={(event) => event.preventDefault()}
          >
            <span className="max-w-48 truncate">{option.label}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}

/** Mounted inside the open menu, so its store subscriptions live only while it is shown. */
export function ProjectRunHostMenuSection({ repo }: { repo: Repo }): React.JSX.Element | null {
  const t = useTranslate()
  const projectHostSetups = useAppStore(
    (state) => getProjectHostSetupProjectionFromState(state).setups
  )
  const repos = useAppStore((state) => state.repos)
  const settings = useAppStore((state) => state.settings)
  const sshTargetLabels = useAppStore((state) => state.sshTargetLabels)
  const sshConnectionStates = useAppStore((state) => state.sshConnectionStates)
  const runtimeEnvironments = useAppStore((state) => state.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useRuntimeStatusByEnvironmentId()
  // Same configured-only registry the composer resolves against, so every option is creatable.
  const hostOptions = buildExecutionHostRegistry({
    repos,
    settings,
    hostSource: 'configured-only',
    sshTargetLabels,
    sshConnectionStates,
    runtimeEnvironments,
    runtimeStatusByEnvironmentId,
    hostLabelOverrides: getHostDisplayLabelOverrides(settings)
  })
  const projectRunHostIds = settings?.projectRunHostIds
  const projectId = getRepoRunHostProjectId(repo, projectHostSetups)
  const options = getProjectRunHostOptions(projectId, projectHostSetups, hostOptions, t)
  return (
    <ProjectRunHostRadioItems
      options={options}
      value={projectRunHostIds?.[projectId] ?? null}
      onValueChange={(hostId) => setProjectRunHost(projectId, hostId)}
    />
  )
}
