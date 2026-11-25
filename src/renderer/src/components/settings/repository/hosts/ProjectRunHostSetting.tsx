import React from 'react'
import { Monitor, Server } from 'lucide-react'
import { SettingsSearchableSelect } from '../../form-controls/SettingsSearchableSelect'
import { useTranslate } from '@/i18n/use-translate'
import {
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import { useAppStore } from '@/store'
import type { ProjectHostSetup } from '../../../../../../shared/project/project-types'
import {
  RUN_HOST_DEFAULT_VALUE,
  getGlobalRunHostLabel,
  getProjectRunHostOptions,
  setProjectRunHost,
  useRunHostCandidates,
  type ProjectRunHostOption
} from '@/lib/workspace/creation/project-run-host'

export type RunHostChoiceOption = ProjectRunHostOption & { disabled?: boolean }

/** Settings row: a dropdown with a default choice (null) plus one entry per host. */
export function RunHostChoiceSetting({
  title,
  description,
  defaultLabel,
  options,
  value,
  onValueChange
}: {
  title: string
  description: string
  defaultLabel: string
  options: readonly RunHostChoiceOption[]
  value: ExecutionHostId | null
  onValueChange: (hostId: ExecutionHostId | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="min-w-0 flex-1 basis-64 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="w-64 max-w-full shrink-0 [&>button]:w-full">
        <SettingsSearchableSelect
          ariaLabel={title}
          value={value ?? RUN_HOST_DEFAULT_VALUE}
          groups={[
            {
              key: 'run-hosts',
              options: [
                { value: RUN_HOST_DEFAULT_VALUE, label: defaultLabel },
                ...options.map((option) => ({
                  value: option.hostId,
                  label: option.label,
                  icon:
                    option.hostId === LOCAL_EXECUTION_HOST_ID ? (
                      <Monitor className="size-4" />
                    ) : (
                      <Server className="size-4" />
                    ),
                  disabled: option.disabled
                }))
              ]
            }
          ]}
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
          searchPlaceholder={t(
            'auto.components.settings.SettingsSearchableSelect.searchHosts',
            'Search hosts…'
          )}
        />
      </div>
    </div>
  )
}

/** "Run on": the host this project's new workspaces and heavy work default to; null = global default. */
export function ProjectRunHostSetting({
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
    <RunHostChoiceSetting
      title={t('settings.projectRunHost.label', 'Run on')}
      description={t(
        'settings.projectRunHost.description',
        'Host where new workspaces of this project are created and run. You can still pick another host when creating one.'
      )}
      defaultLabel={t('settings.projectRunHost.useGlobal', 'Use global default ({{value0}})', {
        value0: globalLabel
      })}
      options={options}
      value={value}
      onValueChange={onValueChange}
    />
  )
}

/** Project settings "Run on", fed by the same heavy-run host list as the project menu. */
export function ProjectRunHostRow({
  projectId,
  projectHostSetups
}: {
  projectId: string
  projectHostSetups: readonly ProjectHostSetup[]
}): React.JSX.Element | null {
  const t = useTranslate()
  const hosts = useRunHostCandidates()
  const value = useAppStore((state) => state.settings?.projectRunHostIds?.[projectId] ?? null)
  const globalHostId = useAppStore((state) => state.settings?.heavyRunHostDefault)
  return (
    <ProjectRunHostSetting
      options={getProjectRunHostOptions(projectId, projectHostSetups, hosts, t)}
      value={value}
      globalLabel={getGlobalRunHostLabel(globalHostId, hosts, t)}
      onValueChange={(hostId) => setProjectRunHost(projectId, hostId)}
    />
  )
}
