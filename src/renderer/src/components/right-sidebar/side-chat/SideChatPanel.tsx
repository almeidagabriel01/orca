import { useEffect, useMemo } from 'react'
import { PanelRightClose, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { structuredAgentSessionAddressTabId } from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import { useStructuredChatTabConversationName } from '@/runtime/native-chat/naming/structured-conversation-name'
import { tabGroupBodyAnchorName } from '../../tab-group/retained-pane/tab-group-body-anchor'
import { registerTabGroupBody } from '../../tab-group/retained-pane/tab-group-body-geometry'
import { useTabGroupTabCloseCommands } from '../../tab-group/workspace-model/useTabGroupTabCloseCommands'
import { TerminalTabLeadingIcon } from '../../tab-bar/terminal-tabs/TerminalTabLeadingIcon'
import { agentTypeToIconAgent } from '../../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { useTerminalTabActivity } from '../../tab-bar/terminal-tabs/use-terminal-tab-activity'
import {
  SIDE_CHAT_DOCK_ANCHOR_KEY,
  isDockedChatTab,
  resolveSelectedDockedTabId,
  useSideChatDockStore
} from './side-chat-dock-state'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: React's CSSProperties lacks anchorName; the value is a plain CSS anchor name.
const BODY_ANCHOR_STYLE = {
  anchorName: tabGroupBodyAnchorName(SIDE_CHAT_DOCK_ANCHOR_KEY)
} as React.CSSProperties
const FOCUS_OWNER_SELECTOR = '[data-side-chat-dock], [data-side-chat-panel]'

function registerBody(node: HTMLDivElement | null): (() => void) | undefined {
  return node ? registerTabGroupBody(SIDE_CHAT_DOCK_ANCHOR_KEY, node) : undefined
}

/** Presses and focus in the app (not body-level portals such as menus) decide who owns the keyboard. */
function useSideChatDockFocusTracking(): void {
  const setFocused = useSideChatDockStore((s) => s.setFocused)
  useEffect(() => {
    const root = document.getElementById('root')
    const onEvent = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest(FOCUS_OWNER_SELECTOR)) {
        setFocused(true)
      } else if (root?.contains(target)) {
        setFocused(false)
      }
    }
    document.addEventListener('pointerdown', onEvent, true)
    document.addEventListener('focusin', onEvent, true)
    return () => {
      document.removeEventListener('pointerdown', onEvent, true)
      document.removeEventListener('focusin', onEvent, true)
      setFocused(false)
    }
  }, [setFocused])
}

function useDockedChatTitle(tab: Tab): string {
  const name = useStructuredChatTabConversationName(tab)
  return tab.customLabel?.trim() || name || tab.label
}

function DockedChatIcon({ tab, current }: { tab: Tab; current: boolean }): React.JSX.Element {
  const { activityStatus, programProgress } = useTerminalTabActivity({
    id: structuredAgentSessionAddressTabId(tab.id, tab.entityId),
    title: tab.label
  })
  return (
    <TerminalTabLeadingIcon
      agent={agentTypeToIconAgent(tab.agentSessionAgent)}
      activityStatus={activityStatus}
      shell={undefined}
      showUnreadActivity={false}
      isActive={current}
      progress={programProgress}
    />
  )
}

function IconAction({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost-muted"
          size="icon-xs"
          className="shrink-0"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The shown side chat's title, in front, with its two actions spelled out. */
function DockedChatHeader({ tab, onClose }: { tab: Tab; onClose: () => void }): React.JSX.Element {
  const t = useTranslate()
  const title = useDockedChatTitle(tab)
  const moveToCenter = t('components.native-chat.sideChat.moveToCenter', 'Move to center')
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 pl-3 pr-2">
      <DockedChatIcon tab={tab} current />
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={title}>
        {title}
      </h2>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="shrink-0"
        aria-label={moveToCenter}
        onClick={() => useAppStore.getState().setTabDock(tab.id, null)}
      >
        <PanelRightClose />
        {/* A narrow panel keeps its room for the title; the icon stays. */}
        <span className="hidden @[27.5rem]:inline">{moveToCenter}</span>
      </Button>
      <IconAction
        label={t('components.rightSidebar.sideChat.close', 'Close {{name}}', { name: title })}
        onClick={onClose}
      >
        <X />
      </IconAction>
    </div>
  )
}

/** One more docked chat to switch to; shown only when there is more than one. */
function DockedChatSwitchItem({
  tab,
  current,
  onSelect
}: {
  tab: Tab
  current: boolean
  onSelect: () => void
}): React.JSX.Element {
  const title = useDockedChatTitle(tab)
  return (
    <button
      type="button"
      className={cn(
        'flex h-6 min-w-0 max-w-full items-center rounded-md px-1.5 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        current && 'bg-accent text-foreground'
      )}
      aria-current={current ? 'page' : undefined}
      onClick={onSelect}
    >
      <DockedChatIcon tab={tab} current={current} />
      <span className="truncate">{title}</span>
    </button>
  )
}

/** Hosts the active worktree's docked chats; the chat itself is the retained center slot, anchored over the body here. */
export default function SideChatPanel(): React.JSX.Element {
  const t = useTranslate()
  useSideChatDockFocusTracking()
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const dockedTabs = useAppStore(
    useShallow((s) =>
      worktreeId ? (s.unifiedTabsByWorktree[worktreeId] ?? []).filter(isDockedChatTab) : []
    )
  )
  const selectedTabId = useSideChatDockStore((s) =>
    worktreeId ? s.selectedTabIdByWorktree[worktreeId] : undefined
  )
  const selectTab = useSideChatDockStore((s) => s.selectTab)
  const currentTabId = useMemo(
    () => resolveSelectedDockedTabId(dockedTabs, selectedTabId),
    [dockedTabs, selectedTabId]
  )
  const { closeItem } = useTabGroupTabCloseCommands({ worktreeId: worktreeId ?? '' })

  if (!worktreeId || dockedTabs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        {t(
          'components.rightSidebar.sideChat.empty',
          'No side chats here. Type /side or /btw in a chat to start one.'
        )}
      </div>
    )
  }
  const currentTab = dockedTabs.find((tab) => tab.id === currentTabId) ?? dockedTabs[0]
  return (
    <div className="@container flex min-h-0 flex-1 flex-col bg-muted" data-side-chat-panel="">
      <DockedChatHeader tab={currentTab} onClose={() => closeItem(currentTab.id)} />
      {dockedTabs.length > 1 ? (
        // Wraps instead of scrolling, so the transcript stays the only scroller.
        <div className="flex shrink-0 flex-wrap gap-1 px-2 pb-2">
          {dockedTabs.map((tab) => (
            <DockedChatSwitchItem
              key={tab.id}
              tab={tab}
              current={tab.id === currentTab.id}
              onSelect={() => selectTab(worktreeId, tab.id)}
            />
          ))}
        </div>
      ) : null}
      {/* A card on the panel's muted surface, so it never reads as a center split. */}
      <div className="mx-2 mb-2 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <div ref={registerBody} className="min-h-0 flex-1" style={BODY_ANCHOR_STYLE} />
      </div>
    </div>
  )
}
