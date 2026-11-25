import React from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTranslate } from '@/i18n/use-translate'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import {
  RUN_HOST_DEFAULT_VALUE,
  type ProjectRunHostOption
} from '@/lib/workspace/creation/project-run-host'

export type RunHostChoiceOption = ProjectRunHostOption & { disabled?: boolean }

/** Settings row: a default choice (null) plus one segment per host. */
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
  return (
    <div className="@container">
      <div className="flex flex-col gap-3 @lg:grid @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-center @lg:gap-8">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ToggleGroup
          type="single"
          value={value ?? RUN_HOST_DEFAULT_VALUE}
          onValueChange={(next) => {
            // '' = the active segment clicked again; keep the current choice.
            if (next === RUN_HOST_DEFAULT_VALUE) {
              onValueChange(null)
              return
            }
            const option = options.find((candidate) => candidate.hostId === next)
            if (option) {
              onValueChange(option.hostId)
            }
          }}
          variant="outline"
          size="sm"
          className="h-auto max-w-full flex-wrap justify-start self-start @lg:justify-end @lg:self-auto"
          aria-label={title}
        >
          <ToggleGroupItem value={RUN_HOST_DEFAULT_VALUE} className="h-8 min-w-0">
            <span className="max-w-56 truncate">{defaultLabel}</span>
          </ToggleGroupItem>
          {options.map((option) => (
            <ToggleGroupItem
              key={option.hostId}
              value={option.hostId}
              disabled={option.disabled}
              className="h-8 min-w-0"
            >
              <span className="max-w-40 truncate">{option.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
