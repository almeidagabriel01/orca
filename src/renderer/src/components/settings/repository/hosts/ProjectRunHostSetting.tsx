import React from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTranslate } from '@/i18n/use-translate'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { ProjectRunHostOption } from '@/lib/workspace/creation/project-run-host'

/** "Run on" segmented control: the host new workspaces of this project default to. */
export function ProjectRunHostSetting({
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
  const label = t('settings.projectRunHost.label', 'Run on')
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {t(
            'settings.projectRunHost.description',
            'Host where new workspaces of this project are created and run. You can still pick another host when creating one.'
          )}
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={value ?? ''}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.hostId === next)
          if (option) {
            onValueChange(option.hostId)
          }
        }}
        variant="outline"
        size="sm"
        className="h-8 max-w-full flex-wrap"
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.hostId}
            value={option.hostId}
            className="h-8 min-w-0 px-3 text-xs"
          >
            <span className="max-w-40 truncate">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
