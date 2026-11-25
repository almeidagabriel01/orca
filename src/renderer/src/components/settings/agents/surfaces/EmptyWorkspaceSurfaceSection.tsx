import type { JSX, ReactNode } from 'react'
import {
  Ban,
  Bot,
  Check,
  ChevronDown,
  FilePlus,
  Globe,
  Smartphone,
  TerminalSquare
} from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { newAgentLaunchesMayOpenChats } from '@/runtime/native-chat/local-sessions/local-structured-chats'
import { buildTabCreateMenuOptions } from '@/components/tab-bar/create-menu/tab-create-menu-options'
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
  emptyWorkspaceSurfaceOpensAgent,
  normalizeEmptyWorkspaceAgentSurface,
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceAgentSurface,
  type EmptyWorkspaceMenuSurface,
  type EmptyWorkspaceSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { nativeChatPreferenceFor } from '../../../../../../shared/agent-launch/choices/structured-native-chat-launch-route'
import { SettingsRow, SettingsSegmentedControl } from '../../form-controls/SettingsFormControls'
import { SettingsGroup } from '../../section-layout/SettingsGroup'
import { EMPTY_WORKSPACE_SURFACE_SECTION_ID } from '../agents-search'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { readHostOwnedSetting } from '../../../../../../shared/settings/host-owned-settings'
import type { SettingsHostScope } from '../../host-scope/settings-host-scope'
import {
  getHostSettingUnsupportedNote,
  getHostSettingUpdateFailedMessage,
  useServerSettingValue,
  useSettingsHostLabel,
  type HostSettingsReply
} from '../../host-scope/use-host-setting'
import { rememberHostEmptyWorkspaceSettings } from '@/lib/workspace/activation/initial-surface/host-empty-workspace-settings'
import { emptyWorkspaceSurfaceOptions } from './empty-workspace-surface-options'

const MENU_ICONS: Record<EmptyWorkspaceMenuSurface, ReactNode> = {
  'new-terminal': <TerminalSquare className="size-4" />,
  'new-browser': <Globe className="size-4" />,
  'new-markdown': <FilePlus className="size-4" />,
  'new-simulator': <Smartphone className="size-4" />
}

type SectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

type HostChoice = Pick<
  GlobalSettings,
  'emptyWorkspaceSurface' | 'emptyWorkspaceAgentSurface' | 'agentDefaultSurface'
>

/** The host's own choice; undefined for an older host that has none. */
function readHostChoice(settings: HostSettingsReply): HostChoice | undefined {
  const surface = readHostOwnedSetting(settings, 'emptyWorkspaceSurface')
  if (surface === undefined) {
    return undefined
  }
  return {
    emptyWorkspaceSurface: surface,
    // A host reports a default how even with no agent chosen; then Open agents as decides.
    ...(emptyWorkspaceSurfaceOpensAgent(surface)
      ? { emptyWorkspaceAgentSurface: readHostOwnedSetting(settings, 'emptyWorkspaceAgentSurface') }
      : {}),
    agentDefaultSurface: readHostOwnedSetting(settings, 'agentDefaultSurface')
  }
}

/**
 * What clicking a workspace with no tabs opens: any + menu item, the default agent, or nothing.
 * Per host, like Open agents as: the picked host's workspaces follow its own choice.
 */
export function EmptyWorkspaceSurfaceSection({
  hostScope,
  ...props
}: SectionProps & { hostScope: SettingsHostScope }): JSX.Element {
  const t = useTranslate()
  const host = useSettingsHostLabel(hostScope.target)
  const environmentId =
    hostScope.target.kind === 'environment' ? hostScope.target.environmentId : null
  const remote = useServerSettingValue({
    environmentId,
    read: readHostChoice,
    updateFailedMessage: getHostSettingUpdateFailedMessage(host, t)
  })
  const simulatorAvailable = isMacOs && props.settings.mobileEmulatorEnabled !== false
  if (!environmentId) {
    return <EmptyWorkspaceSurfaceView {...props} simulatorAvailable={simulatorAvailable} />
  }
  if (remote.setting.state !== 'ready') {
    return (
      <div id={EMPTY_WORKSPACE_SURFACE_SECTION_ID} className="scroll-mt-8">
        <SettingsGroup>
          <SettingsRow
            label={t('settings.agents.emptyWorkspace.title', 'Opening a workspace with no tabs')}
            description={
              remote.setting.state === 'unsupported' ? getHostSettingUnsupportedNote(host, t) : null
            }
            control={remote.setting.state === 'loading' ? <LoadingSpinner /> : null}
          />
        </SettingsGroup>
      </div>
    )
  }
  const choice = remote.setting.value
  const write = (updates: Partial<GlobalSettings>): void => {
    const next = { ...choice, ...updates }
    rememberHostEmptyWorkspaceSettings(environmentId, next)
    void remote.update(updates, next)
  }
  return (
    <EmptyWorkspaceSurfaceView
      // Only the host's own values decide; this computer's per-agent choices do not apply there.
      settings={{ ...props.settings, nativeChatProviders: undefined, ...choice }}
      updateSettings={write}
      simulatorAvailable={simulatorAvailable}
    />
  )
}

export function EmptyWorkspaceSurfaceView({
  settings,
  updateSettings,
  simulatorAvailable
}: SectionProps & {
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
  const options = emptyWorkspaceSurfaceOptions(menuOptions)
  const saved = settings.defaultTuiAgent === 'blank' ? null : settings.defaultTuiAgent
  // Unset follows the original rule, so show what it does today. An older `agent:<id>` reads as
  // the default agent: the project's default, else the global one, picks which agent opens.
  const stored = normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface)
  const value: EmptyWorkspaceSurface = emptyWorkspaceSurfaceOpensAgent(stored)
    ? 'default-agent'
    : (stored ??
      (saved && newAgentLaunchesMayOpenChats(settings) ? 'default-agent' : 'new-terminal'))
  const opensAgent = value === 'default-agent'
  // Unset follows Open agents as for the default agent, so show what that opens today.
  const agentSurface: EmptyWorkspaceAgentSurface =
    normalizeEmptyWorkspaceAgentSurface(settings.emptyWorkspaceAgentSurface) ??
    (nativeChatPreferenceFor(settings, saved ?? '') ? 'chat' : 'terminal')
  const pick = (surface: EmptyWorkspaceSurface): void => {
    // Saved with how the agent opens, so the choice stays as shown.
    updateSettings(
      surface === 'default-agent'
        ? { emptyWorkspaceSurface: surface, emptyWorkspaceAgentSurface: agentSurface }
        : { emptyWorkspaceSurface: surface }
    )
  }
  const menuItems = options.map((option) => ({
    id: option.value,
    label: option.label,
    icon: MENU_ICONS[option.value],
    run: () => pick(option.value)
  }))
  const title = t('settings.agents.emptyWorkspace.title', 'Opening a workspace with no tabs')
  const nothing = t('settings.agents.emptyWorkspace.nothing', 'Nothing')
  const defaultAgent = t('settings.agents.emptyWorkspace.defaultAgent', 'Default agent')
  const current =
    value === 'nothing'
      ? { icon: <Ban className="size-4" />, label: nothing }
      : opensAgent
        ? { icon: <Bot className="size-4" />, label: defaultAgent }
        : (menuItems.find((item) => item.id === value) ?? {
            icon: MENU_ICONS['new-terminal'],
            label: value
          })
  return (
    <div id={EMPTY_WORKSPACE_SURFACE_SECTION_ID} className="scroll-mt-8">
      <SettingsGroup>
        <SettingsRow
          label={title}
          description={t(
            'settings.agents.emptyWorkspace.descriptionDefaultAgent',
            "Any item of the + menu, the project's default agent (else the global one), or nothing."
          )}
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
                className="w-72 max-w-[calc(100vw-1rem)]"
              >
                {/* Named rows, not an icon strip: every choice says what it opens. */}
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.id} variant="launch" onSelect={item.run}>
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {value === item.id ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="launch" onSelect={() => pick('default-agent')}>
                  <Bot className="size-3.5" />
                  <span className="flex-1">{defaultAgent}</span>
                  {opensAgent ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem variant="launch" onSelect={() => pick('nothing')}>
                  <Ban className="size-3.5" />
                  <span className="flex-1">{nothing}</span>
                  {value === 'nothing' ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </DropdownMenuItem>
              </NewTabMenuContent>
            </DropdownMenu>
          }
        />
        {opensAgent ? (
          <SettingsRow
            label={t('settings.agents.emptyWorkspace.openAs', 'Open as')}
            description={t(
              'settings.agents.emptyWorkspace.openAsDescription',
              'Chat opens the chat UI; Terminal opens the agent in a terminal.'
            )}
            control={
              <SettingsSegmentedControl
                size="sm"
                ariaLabel={t('settings.agents.emptyWorkspace.openAs', 'Open as')}
                value={agentSurface}
                onChange={(surface) =>
                  updateSettings({
                    emptyWorkspaceSurface: value,
                    emptyWorkspaceAgentSurface: surface
                  })
                }
                options={[
                  { value: 'chat', label: t('settings.agents.emptyWorkspace.openAsChat', 'Chat') },
                  {
                    value: 'terminal',
                    label: t('settings.agents.emptyWorkspace.openAsTerminal', 'Terminal')
                  }
                ]}
              />
            }
          />
        ) : null}
      </SettingsGroup>
    </div>
  )
}
