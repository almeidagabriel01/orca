import React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import {
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import { translateHostDisplayLabel } from '@/runtime/hosts/display/execution-host-label'
import {
  setHeavyRunHostDefault,
  useRunHostCandidates
} from '@/lib/workspace/creation/project-run-host'
import {
  RunHostChoiceSetting,
  type RunHostChoiceOption
} from '../../repository/hosts/ProjectRunHostSetting'

/** Presentational "Run heavy work on" row; null = Automatic. */
export function HeavyRunHostDefaultSetting({
  options,
  value,
  onValueChange
}: {
  options: readonly RunHostChoiceOption[]
  value: ExecutionHostId | null
  onValueChange: (hostId: ExecutionHostId | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div data-settings-section="heavy-run-host-default" className="scroll-mt-8">
      <RunHostChoiceSetting
        title={t('settings.heavyRunHostDefault.label', 'Run heavy work on')}
        description={t(
          'settings.heavyRunHostDefault.description',
          'Host new workspaces and heavy commands go to when a project has no Run on host of its own. Automatic keeps choosing per project.'
        )}
        defaultLabel={t('settings.heavyRunHostDefault.automatic', 'Automatic')}
        options={options}
        value={value}
        onValueChange={onValueChange}
      />
    </div>
  )
}

/** allowLocalRuntime=false on the web client: its "local" is the browser, which runs nothing. */
export function HeavyRunHostDefaultRow({
  allowLocalRuntime
}: {
  allowLocalRuntime: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const hosts = useRunHostCandidates().filter(
    (host) => allowLocalRuntime || host.id !== LOCAL_EXECUTION_HOST_ID
  )
  const value = useAppStore((state) => state.settings?.heavyRunHostDefault ?? null)
  const options: RunHostChoiceOption[] = hosts.map((host) => ({
    hostId: host.id,
    label: translateHostDisplayLabel(host, t)
  }))
  return (
    <HeavyRunHostDefaultSetting
      options={options}
      value={value}
      onValueChange={setHeavyRunHostDefault}
    />
  )
}
