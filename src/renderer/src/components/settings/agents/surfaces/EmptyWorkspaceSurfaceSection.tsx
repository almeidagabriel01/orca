import type { JSX, ReactNode } from 'react'
import { Ban, Check, ChevronDown, FilePlus, Globe, Smartphone, TerminalSquare } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { newAgentLaunchesMayOpenChats } from '@/runtime/native-chat/local-sessions/local-structured-chats'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { AgentLaunchPickerMenu } from '@/components/agent/AgentLaunchPickerMenu'
import { useAgentLaunchPickerInventorySource } from '@/components/agent/use-agent-launch-picker-inventory'
import { useAgentPickerInventoryEntries } from '@/components/agent/agent-picker-inventory-source'
import { useAgentMenuObservation } from '@/components/agent/launch-menu/use-new-tab-agent-menu-rows'
import {
  buildTabCreateMenuOptions,
  findMatchingTabCreateMenuOptions
} from '@/components/tab-bar/create-menu/tab-create-menu-options'
import { TabBarCreateRowPicker } from '@/components/tab-bar/create-menu/TabBarCreateRowPicker'
import { NewTabMenuContent } from '@/components/tab-bar/menu-fit/NewTabMenuContent'
import { isMacOs } from '@/components/tab-bar/model/use-tab-bar-runtime-model'
import { Button } from '../../../ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../../ui/dropdown-menu'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import {
  emptyWorkspaceSurfaceAgent,
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceMenuSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import type { AgentPickerEntry } from '../../../../../../shared/agent-launch/picker/agent-launch-picker'
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
  'new-terminal': <TerminalSquare className="size-4" />,
  'new-browser': <Globe className="size-4" />,
  'new-markdown': <FilePlus className="size-4" />,
  'new-simulator': <Smartphone className="size-4" />
}
const agentLabel = (agent: TuiAgent): string =>
  getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent

type SectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

/** What clicking a workspace with no tabs opens: any + menu item, an installed agent, or nothing. */
export function EmptyWorkspaceSurfaceSection(props: SectionProps): JSX.Element {
  // The + menu's own agent inventory for this computer.
  const { model } = useAgentMenuObservation(null, true, LOCAL_AGENTS)
  const entries = useAgentPickerInventoryEntries(
    useAgentLaunchPickerInventorySource(undefined, model, true)
  )
  return (
    <EmptyWorkspaceSurfaceView
      {...props}
      agentEntries={model.state === 'settled' ? entries : null}
      simulatorAvailable={isMacOs && props.settings.mobileEmulatorEnabled !== false}
    />
  )
}

export function EmptyWorkspaceSurfaceView({
  settings,
  updateSettings,
  agentEntries,
  simulatorAvailable
}: SectionProps & {
  /** Null while the agent inventory loads. */
  agentEntries: AgentPickerEntry[] | null
  simulatorAvailable: boolean
}): JSX.Element {
  const t = useTranslate()
  const menuOptions = buildTabCreateMenuOptions(
    {
      hasNewBrowser: true,
      hasNewMarkdown: true,
      hasOpenMarkdown: false,
      hasSimulator: simulatorAvailable,
      simulatorIsGoTo: false,
      terminalOnly: false
    },
    t
  )
  const options = emptyWorkspaceSurfaceOptions(menuOptions, agentEntries ?? [])
  const saved = settings.defaultTuiAgent === 'blank' ? null : settings.defaultTuiAgent
  // Unset follows the original rule, so show what it does today.
  const value: EmptyWorkspaceSurface =
    normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface) ??
    (saved && newAgentLaunchesMayOpenChats(settings) ? `agent:${saved}` : 'new-terminal')
  const valueAgent = emptyWorkspaceSurfaceAgent(value)
  const missingAgent = emptyWorkspaceAgentMissing(value, options, agentEntries !== null)
    ? valueAgent
    : null
  const pick = (surface: EmptyWorkspaceSurface): void =>
    updateSettings({ emptyWorkspaceSurface: surface })
  const menuItems = options.flatMap((option) =>
    option.kind === 'menu'
      ? [
          {
            id: option.value,
            label: option.label,
            icon: MENU_ICONS[option.value],
            run: () => pick(option.value)
          }
        ]
      : []
  )
  const title = t('settings.agents.emptyWorkspace.title', 'Opening a workspace with no tabs')
  const nothing = t('settings.agents.emptyWorkspace.nothing', 'Nothing')
  const current =
    value === 'nothing'
      ? { icon: <Ban className="size-4" />, label: nothing }
      : valueAgent
        ? {
            icon: <AgentIcon agent={valueAgent} size={16} />,
            label: agentLabel(valueAgent)
          }
        : {
            icon: MENU_ICONS[value as EmptyWorkspaceMenuSurface],
            label: menuItems.find((item) => item.id === value)?.label ?? value
          }
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
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={title}
                  className="w-56 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {current.icon}
                    <span className="truncate">{current.label}</span>
                  </span>
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <NewTabMenuContent
                align="end"
                sideOffset={6}
                className="w-72 max-w-[calc(100vw-1rem)] rounded-[11px] border-border/80 p-1 shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
              >
                <AgentLaunchPickerMenu
                  mode="select"
                  setupDisabled
                  collapseUnready
                  entries={agentEntries ?? []}
                  checkedAgent={valueAgent}
                  onSelectAgent={(agent) => pick(`agent:${agent}`)}
                  runLaunch={() => {}}
                  header={(query) => {
                    const shown = query.trim()
                      ? findMatchingTabCreateMenuOptions(query, menuOptions).flatMap((option) =>
                          menuItems.filter((item) => item.id === option.id)
                        )
                      : menuItems
                    return shown.length ? (
                      <>
                        <DropdownMenuSeparator className="my-0 mb-1.5" />
                        <TabBarCreateRowPicker items={shown} checkedId={value} label={title} />
                        <DropdownMenuSeparator />
                      </>
                    ) : (
                      <DropdownMenuSeparator className="my-0 mb-1.5" />
                    )
                  }}
                  footer={
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="launch" onSelect={() => pick('nothing')}>
                        <Ban className="size-3.5" />
                        <span className="flex-1">{nothing}</span>
                        {value === 'nothing' ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : null}
                      </DropdownMenuItem>
                    </>
                  }
                />
              </NewTabMenuContent>
            </DropdownMenu>
          }
        />
      </SettingsGroup>
    </div>
  )
}
