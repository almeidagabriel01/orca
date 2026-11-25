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
  getGlobalRunHostLabel,
  getProjectRunHostOptions,
  getRepoRunHostProjectId,
  setProjectRunHost,
  useRunHostCandidates,
  RUN_HOST_DEFAULT_VALUE,
  type ProjectRunHostOption
} from '@/lib/workspace/creation/project-run-host'

/** Presentational "Run on" radio list; renders nothing for a single-host project. null = global default. */
export function ProjectRunHostRadioItems({
  options,
  value,
  globalLabel,
  onValueChange
}: {
  options: readonly ProjectRunHostOption[]
  value: ExecutionHostId | null
  globalLabel: string
  onValueChange: (hostId: ExecutionHostId | null) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  if (options.length < 2) {
    return null
  }
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>
        <span className="flex items-center gap-1.5">
          <Server className="size-3.5" />
          {t('sidebar.projectRunHost.label', 'Run on')}
        </span>
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value ?? RUN_HOST_DEFAULT_VALUE}
        onValueChange={(next) => {
          if (next === RUN_HOST_DEFAULT_VALUE) {
            onValueChange(null)
            return
          }
          const option = options.find((candidate) => candidate.hostId === next)
          if (option) {
            onValueChange(option.hostId)
          }
        }}
      >
        <DropdownMenuRadioItem
          value={RUN_HOST_DEFAULT_VALUE}
          // Keep the menu open so the new check is visible.
          onSelect={(event) => event.preventDefault()}
        >
          <span className="max-w-56 truncate">
            {t('settings.projectRunHost.useGlobal', 'Use global default ({{value0}})', {
              value0: globalLabel
            })}
          </span>
        </DropdownMenuRadioItem>
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.hostId}
            value={option.hostId}
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
  const projectRunHostIds = useAppStore((state) => state.settings?.projectRunHostIds)
  const heavyRunHostDefault = useAppStore((state) => state.settings?.heavyRunHostDefault)
  // Same configured-only registry the composer resolves against, so every option is creatable.
  const hostOptions = useRunHostCandidates()
  const projectId = getRepoRunHostProjectId(repo, projectHostSetups)
  const options = getProjectRunHostOptions(projectId, projectHostSetups, hostOptions, t)
  return (
    <ProjectRunHostRadioItems
      options={options}
      value={projectRunHostIds?.[projectId] ?? null}
      globalLabel={getGlobalRunHostLabel(heavyRunHostDefault, hostOptions, t)}
      onValueChange={(hostId) => setProjectRunHost(projectId, hostId)}
    />
  )
}
