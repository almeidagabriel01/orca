import { useMemo, useState } from 'react'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import type { AgentModelOptionChoices } from '../../../../../shared/agent-launch/choices/agent-launch-choices'
import {
  normalizeProjectAgentLaunchDefaults,
  type ProjectAgentLaunchDefaults,
  type ProjectAgentSurface
} from '../../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import {
  getRepoExecutionHostId,
  parseExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { lastVerifiedRuntimeStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { useAppStore } from '@/store'
import { getProjectSetupRuntimeTarget } from '@/store/projects/project-host-routing'
import { getRuntimeEnvironmentRevision } from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import { useHostAgentMenuSettings } from '@/runtime/agent-launch-settings/use-host-agent-launch-preferences'
import { RepositoryAgentAccountDefault } from './RepositoryAgentAccountDefault'
import { AgentChoiceControls } from '../../agent/launch-settings/AgentChoiceControls'
import { useAgentSettingsModelCatalog } from '../../agent/launch-settings/use-agent-settings-model-catalog'
import { Button } from '../../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SettingsRow } from '../form-controls/SettingsFormControls'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { SettingsGroup } from '../section-layout/SettingsGroup'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { translate } from '@/i18n/i18n'
import { matchesSettingsSearch } from '../search/settings-search'
import { useServerSettingValue, type HostSettingsReply } from '../host-scope/use-host-setting'
import { readHostOwnedSetting } from '../../../../../shared/settings/host-owned-settings'
import { getRepositoryAgentDefaultsSectionId } from './repository-settings-targets'

export function getRepositoryAgentDefaultsSearchEntry(t: Translate = translate) {
  return {
    title: t('settings.projectAgentDefaults.title', 'Agent defaults'),
    description: t(
      'settings.projectAgentDefaults.description',
      'Default agent, model and account for new work in this project. Unset choices inherit this host’s defaults.'
    ),
    keywords: [
      t(
        'settings.projectAgentDefaults.keywords',
        'agent model reasoning effort account default open as chat terminal surface'
      )
    ]
  }
}

const readHostAgentSurface = (settings: HostSettingsReply): ProjectAgentSurface | undefined =>
  readHostOwnedSetting(settings, 'agentDefaultSurface')

/** False when the host refused, dropped or failed the save. */
async function saveProjectDefaults(
  updateRepo: ProjectDefaultsSectionProps['updateRepo'],
  repoId: string,
  next: ProjectAgentLaunchDefaults | undefined
): Promise<boolean> {
  try {
    const result = await updateRepo(repoId, {
      agentLaunchDefaults: normalizeProjectAgentLaunchDefaults(next) ?? null
    })
    return result !== false
  } catch {
    return false
  }
}

type ProjectDefaultsSectionProps = {
  repo: Repo
  updateRepo: (
    id: string,
    updates: { agentLaunchDefaults: ProjectAgentLaunchDefaults | null }
  ) => void | Promise<boolean>
  forceVisible?: boolean
}

export function RepositoryAgentDefaultsSection(
  props: ProjectDefaultsSectionProps
): React.JSX.Element | null {
  const t = useTranslate()
  const search = useAppStore((state) => state.settingsSearchQuery)
  if (
    !props.forceVisible &&
    !matchesSettingsSearch(search, [getRepositoryAgentDefaultsSearchEntry(t)])
  ) {
    return null
  }
  return <RepositoryAgentDefaultsEditor {...props} />
}

function RepositoryAgentDefaultsEditor({
  repo,
  updateRepo,
  forceVisible
}: ProjectDefaultsSectionProps): React.JSX.Element {
  const t = useTranslate()
  const hostId = getRepoExecutionHostId(repo)
  const parsed = parseExecutionHostId(hostId)
  const environmentId = parsed?.kind === 'runtime' ? parsed.environmentId : undefined
  const settings = useAppStore((state) => state.settings)
  const status = useAppStore((state) =>
    environmentId ? state.runtimeStatusByEnvironmentId.get(environmentId) : undefined
  )
  const owner = environmentId
    ? {
        executionHostId: hostId,
        pairingRevision: getRuntimeEnvironmentRevision(environmentId),
        runtimeId: lastVerifiedRuntimeStatus(status)?.runtimeId,
        contact: String(status?.hostContactEpoch ?? '')
      }
    : null
  const { settings: hostSettings, pending } = useHostAgentMenuSettings(owner, settings, true, false)
  const remoteSurface = useServerSettingValue({
    environmentId: environmentId ?? null,
    read: readHostAgentSurface,
    updateFailedMessage: ''
  }).setting
  const hostSurface: ProjectAgentSurface | undefined = environmentId
    ? remoteSurface.state === 'ready'
      ? remoteSurface.value
      : undefined
    : settings?.agentDefaultSurface
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const defaults = repo.agentLaunchDefaults
  const selected = defaults?.defaultTuiAgent ?? hostSettings?.defaultTuiAgent
  const agent = selected && selected !== 'blank' ? selected : null
  const [editingAgent, setEditingAgent] = useState<TuiAgent | null>(null)
  const modelAgent = editingAgent ?? agent ?? 'codex'
  const target = useMemo(() => getProjectSetupRuntimeTarget(hostId), [hostId])
  const { catalog, usesSeedModels } = useAgentSettingsModelCatalog(modelAgent, target)
  const entry = getRepositoryAgentDefaultsSearchEntry(t)
  const save = async (next: ProjectAgentLaunchDefaults | undefined): Promise<void> => {
    setSaving(true)
    setError(false)
    const saved = await saveProjectDefaults(updateRepo, repo.id, next)
    setError(!saved)
    setSaving(false)
  }
  const saveChoices = (choice: AgentModelOptionChoices | undefined): void => {
    const choices = { ...defaults?.agentLaunchChoices }
    if (choice) {
      choices[modelAgent] = choice
    } else {
      delete choices[modelAgent]
    }
    void save({ ...defaults, agentLaunchChoices: choices })
  }
  const saveAccount = (choice: string | undefined): void => {
    const accounts = { ...defaults?.agentAccounts }
    if (choice) {
      accounts[modelAgent] = choice
    } else {
      delete accounts[modelAgent]
    }
    void save({ ...defaults, agentAccounts: accounts })
  }
  const disabled = pending || saving
  const surfaceLabel = (surface: ProjectAgentSurface): string =>
    surface === 'chat'
      ? t('settings.projectAgentDefaults.surfaceChat', 'Chat')
      : t('settings.projectAgentDefaults.surfaceTerminal', 'Terminal')
  const inherit = t('settings.projectAgentDefaults.inherit', 'Use host default')
  const agents = getAgentCatalog()
  return (
    <SearchableSetting
      {...entry}
      forceVisible={forceVisible}
      id={getRepositoryAgentDefaultsSectionId(repo.id)}
    >
      <SettingsGroup title={entry.title} description={entry.description}>
        <SettingsRow
          label={t('settings.projectAgentDefaults.agent', 'Default agent')}
          control={
            <Select
              value={defaults?.defaultTuiAgent ?? 'inherit'}
              disabled={disabled}
              onValueChange={(value) => {
                const next =
                  value === 'inherit'
                    ? undefined
                    : (agents.find((candidate) => candidate.id === value)?.id ?? 'blank')
                setEditingAgent(null)
                void save({ ...defaults, defaultTuiAgent: next })
              }}
            >
              <SelectTrigger aria-label={t('settings.projectAgentDefaults.agent', 'Default agent')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{inherit}</SelectItem>
                <SelectItem value="blank">
                  {t('settings.projectAgentDefaults.blank', 'Blank terminal')}
                </SelectItem>
                {agents.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <SettingsRow
          label={t('settings.projectAgentDefaults.surface', 'Open as')}
          description={
            selected === 'blank'
              ? t(
                  'settings.projectAgentDefaults.surfaceBlank',
                  'Not used with a blank terminal; it always opens as a terminal.'
                )
              : undefined
          }
          control={
            <Select
              value={defaults?.defaultSurface ?? 'inherit'}
              disabled={disabled || selected === 'blank'}
              onValueChange={(value) =>
                void save({
                  ...defaults,
                  defaultSurface: value === 'inherit' ? undefined : (value as ProjectAgentSurface)
                })
              }
            >
              <SelectTrigger aria-label={t('settings.projectAgentDefaults.surface', 'Open as')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  {hostSurface
                    ? t(
                        'settings.projectAgentDefaults.surfaceInherit',
                        'Host default ({{surface}})',
                        {
                          surface: surfaceLabel(hostSurface)
                        }
                      )
                    : inherit}
                </SelectItem>
                <SelectItem value="chat">{surfaceLabel('chat')}</SelectItem>
                <SelectItem value="terminal">{surfaceLabel('terminal')}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsRow
          label={t('settings.projectAgentDefaults.modelsFor', 'Model defaults for')}
          control={
            <Select
              value={modelAgent}
              disabled={disabled}
              onValueChange={(value) =>
                setEditingAgent(agents.find((candidate) => candidate.id === value)?.id ?? null)
              }
            >
              <SelectTrigger
                aria-label={t('settings.projectAgentDefaults.modelsFor', 'Model defaults for')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <div className="py-3">
          <AgentChoiceControls
            agent={modelAgent}
            value={defaults?.agentLaunchChoices?.[modelAgent]}
            liveCatalog={catalog}
            usesSeedModels={usesSeedModels}
            optionIds={['effort']}
            layout="rows"
            disabled={disabled}
            defaultLabels={{ model: inherit, options: { effort: inherit } }}
            onChange={saveChoices}
          />
        </div>
        <RepositoryAgentAccountDefault
          agent={modelAgent}
          target={target}
          value={defaults?.agentAccounts?.[modelAgent]}
          disabled={disabled}
          inheritLabel={inherit}
          onChange={saveAccount}
        />
        <div className="py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || !defaults}
            onClick={() => void save(undefined)}
          >
            {t('settings.projectAgentDefaults.reset', 'Reset to host defaults')}
          </Button>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {t(
                'settings.projectAgentDefaults.saveFailed',
                'Could not save project defaults. Check the connection and update the project’s runtime if needed.'
              )}
            </p>
          ) : null}
        </div>
      </SettingsGroup>
    </SearchableSetting>
  )
}
