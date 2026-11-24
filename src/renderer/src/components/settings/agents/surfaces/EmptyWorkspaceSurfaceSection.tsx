import type { JSX, ReactNode } from 'react'
import { Ban, FilePlus, Globe, Smartphone, TerminalSquare } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { newAgentLaunchesMayOpenChats } from '@/runtime/native-chat/local-sessions/local-structured-chats'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useAgentMenuObservation } from '@/components/agent/launch-menu/use-new-tab-agent-menu-rows'
import { buildTabCreateMenuOptions } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import { isMacOs } from '@/components/tab-bar/model/use-tab-bar-runtime-model'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import {
  emptyWorkspaceSurfaceAgent,
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceMenuSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import type { NewTabAgentMenuRow } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import { SettingsRow } from '../../form-controls/SettingsFormControls'
import { SettingsGroup } from '../../section-layout/SettingsGroup'
import { EMPTY_WORKSPACE_SURFACE_SECTION_ID } from '../agents-search'
import {
  emptyWorkspaceAgentMissing,
  emptyWorkspaceSurfaceOptions
} from './empty-workspace-surface-options'

const LOCAL_AGENTS = { kind: 'local' } as const
const MENU_ICONS: Record<EmptyWorkspaceMenuSurface, ReactNode> = {
  'new-terminal': <TerminalSquare />,
  'new-browser': <Globe />,
  'new-markdown': <FilePlus />,
  'new-simulator': <Smartphone />
}
const agentLabel = (agent: TuiAgent): string =>
  getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent

type SectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

/** What clicking a workspace with no tabs opens: any + menu item, an installed agent, or nothing. */
export function EmptyWorkspaceSurfaceSection(props: SectionProps): JSX.Element {
  // The + menu's own agent rows for this computer.
  const { model } = useAgentMenuObservation(null, true, LOCAL_AGENTS)
  return (
    <EmptyWorkspaceSurfaceView
      {...props}
      agentRows={model.state === 'settled' ? model.rows : null}
      simulatorAvailable={isMacOs && props.settings.mobileEmulatorEnabled !== false}
    />
  )
}

export function EmptyWorkspaceSurfaceView({
  settings,
  updateSettings,
  agentRows,
  simulatorAvailable
}: SectionProps & {
  /** Null while the agent inventory loads. */
  agentRows: readonly NewTabAgentMenuRow[] | null
  simulatorAvailable: boolean
}): JSX.Element {
  const t = useTranslate()
  const options = emptyWorkspaceSurfaceOptions(
    buildTabCreateMenuOptions(
      {
        hasNewBrowser: true,
        hasNewMarkdown: true,
        hasOpenMarkdown: false,
        hasSimulator: simulatorAvailable,
        simulatorIsGoTo: false,
        terminalOnly: false
      },
      t
    ),
    agentRows ?? [],
    agentLabel
  )
  const saved = settings.defaultTuiAgent === 'blank' ? null : settings.defaultTuiAgent
  // Unset follows the original rule, so show what it does today.
  const value: EmptyWorkspaceSurface =
    normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface) ??
    (saved && newAgentLaunchesMayOpenChats(settings) ? `agent:${saved}` : 'new-terminal')
  const missingAgent = emptyWorkspaceAgentMissing(value, options, agentRows !== null)
    ? emptyWorkspaceSurfaceAgent(value)
    : null
  const title = t('settings.agents.emptyWorkspace.title', 'Opening a workspace with no tabs')
  return (
    <div id={EMPTY_WORKSPACE_SURFACE_SECTION_ID} className="scroll-mt-8">
      <SettingsGroup>
        <SettingsRow
          label={title}
          description={
            missingAgent ? (
              <span className="text-status-warning-text">
                {t(
                  'settings.agents.emptyWorkspace.agentMissing',
                  "{{agent}} isn't installed here, so a terminal opens instead.",
                  { agent: agentLabel(missingAgent) }
                )}
              </span>
            ) : (
              t(
                'settings.agents.emptyWorkspace.description',
                'Any item of the + menu. Agents open as chat or terminal, as Open agents as says.'
              )
            )
          }
          control={
            <Select
              value={value}
              onValueChange={(next) => {
                const surface = normalizeEmptyWorkspaceSurface(next)
                if (surface) {
                  updateSettings({ emptyWorkspaceSurface: surface })
                }
              }}
            >
              <SelectTrigger aria-label={title} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.kind === 'menu' ? (
                      MENU_ICONS[option.value]
                    ) : (
                      <AgentIcon agent={option.agent} size={16} />
                    )}
                    {option.label}
                  </SelectItem>
                ))}
                {missingAgent ? (
                  <SelectItem value={value} disabled>
                    <AgentIcon agent={missingAgent} size={16} />
                    {agentLabel(missingAgent)}
                  </SelectItem>
                ) : null}
                <SelectItem value="nothing">
                  <Ban />
                  {t('settings.agents.emptyWorkspace.nothing', 'Nothing')}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsGroup>
    </div>
  )
}
