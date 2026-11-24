import type { JSX } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { newAgentLaunchesMayOpenChats } from '@/runtime/native-chat/local-sessions/local-structured-chats'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import {
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { SettingsRow, SettingsSegmentedControl } from '../../form-controls/SettingsFormControls'
import { SettingsGroup } from '../../section-layout/SettingsGroup'
import { EMPTY_WORKSPACE_SURFACE_SECTION_ID } from '../agents-search'

/** What clicking a workspace with no tabs opens. */
export function EmptyWorkspaceSurfaceSection({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): JSX.Element {
  const t = useTranslate()
  const saved = settings.defaultTuiAgent && settings.defaultTuiAgent !== 'blank'
  // Unset follows the original rule, so show what it does today.
  const value: EmptyWorkspaceSurface =
    normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface) ??
    (saved && newAgentLaunchesMayOpenChats(settings) ? 'agent-chat' : 'terminal')
  const title = t('settings.agents.emptyWorkspace.title', 'Opening a workspace with no tabs')
  return (
    <div id={EMPTY_WORKSPACE_SURFACE_SECTION_ID} className="scroll-mt-8">
      <SettingsGroup>
        <SettingsRow
          label={title}
          description={t(
            'settings.agents.emptyWorkspace.description',
            "Agent chat opens the default agent (Claude when it is Auto) on the project's default account."
          )}
          control={
            <SettingsSegmentedControl
              ariaLabel={title}
              value={value}
              onChange={(next) => updateSettings({ emptyWorkspaceSurface: next })}
              options={[
                {
                  value: 'terminal',
                  label: t('settings.agents.emptyWorkspace.terminal', 'Terminal')
                },
                {
                  value: 'agent-chat',
                  label: t('settings.agents.emptyWorkspace.agentChat', 'Agent chat')
                },
                { value: 'nothing', label: t('settings.agents.emptyWorkspace.nothing', 'Nothing') }
              ]}
            />
          }
        />
      </SettingsGroup>
    </div>
  )
}
