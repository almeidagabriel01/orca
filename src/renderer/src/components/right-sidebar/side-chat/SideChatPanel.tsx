import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText, PanelRightClose, Plus, X } from 'lucide-react'
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
import { selectFocusedChatTab } from '@/lib/focused-chat-workers'
import { useSideChatSourceStore } from './side-chat-sources'
import type { NativeChatSideChat } from '../../native-chat/messages/actions/use-native-chat-side-chat'
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

function useChatTabTitle(tab: Tab): string {
  const name = useStructuredChatTabConversationName(tab)
  return tab.customLabel?.trim() || name || tab.label
}

type NewSideChat = {
  /** The center chat a new side chat forks from. */
  sourceTab: Tab | null
  /** Why none can start now; shown, never only on hover. */
  unavailable: string | null
  starting: boolean
  /** Why the last start failed, while the same chat is focused. */
  error: string | null
  start: () => void
}

/** Starts a side chat from the workspace's focused center chat, as `/side` does with no question. */
function useNewSideChat(worktreeId: string): NewSideChat {
  const t = useTranslate()
  const sourceTab = useAppStore((s) => selectFocusedChatTab(s, worktreeId))
  const sourceTabId = sourceTab?.id
  const sideChat = useSideChatSourceStore((s) => (sourceTabId ? s.byTabId[sourceTabId] : undefined))
  const [starting, setStarting] = useState(false)
  const [failure, setFailure] = useState<{
    source: NativeChatSideChat | undefined
    reason: string
  } | null>(null)
  const unavailable = !sourceTab
    ? t(
        'components.rightSidebar.sideChat.noSource',
        'Open a chat in this workspace to ask it a side question.'
      )
    : !sideChat
      ? t('components.rightSidebar.sideChat.cannotFork', 'This chat can’t start side chats.')
      : sideChat.notReadyReason
  const start = (): void => {
    if (starting || !sourceTabId) {
      return
    }
    if (!sideChat || sideChat.notReadyReason) {
      setFailure({ source: sideChat, reason: unavailable ?? '' })
      return
    }
    setFailure(null)
    setStarting(true)
    void sideChat
      .open('')
      .then((result) => {
        if ('refused' in result || !result.started) {
          setFailure({
            source: sideChat,
            reason:
              'refused' in result
                ? result.refused
                : t(
                    'components.rightSidebar.sideChat.startFailed',
                    'The side chat didn’t start. Try again.'
                  )
          })
        }
      })
      .finally(() => setStarting(false))
  }
  // A new focused chat or a change in its fork point (a reply finished) retires the old reason.
  const error = failure && failure.source === sideChat ? failure.reason : null
  return { sourceTab, unavailable, starting, error, start }
}

function SourceChatPrompt({ tab }: { tab: Tab }): React.JSX.Element {
  const t = useTranslate()
  const name = useChatTabTitle(tab)
  return (
    <>
      {t(
        'components.rightSidebar.sideChat.prompt',
        'Ask a side question in a copy of “{{name}}”. The chat keeps going.',
        { name }
      )}
    </>
  )
}

/** No side chat yet: what one is, where it forks from, and the one button that starts it. */
function SideChatStart({ newChat }: { newChat: NewSideChat }): React.JSX.Element {
  const t = useTranslate()
  const { sourceTab, unavailable, starting, error, start } = newChat
  const reason = error ?? (starting ? null : unavailable)
  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {/* m-auto, not justify-center, so a short panel scrolls to the top instead of clipping it. */}
      <div className="m-auto flex w-full max-w-xs flex-col items-center gap-3 text-center">
        <MessageSquareText className="size-5 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t('components.rightSidebar.sideChat.tab', 'Side chat')}
          </h2>
          {sourceTab ? (
            <p className="text-xs text-muted-foreground">
              <SourceChatPrompt tab={sourceTab} />
            </p>
          ) : null}
        </div>
        <Button type="button" size="xs" disabled={starting || unavailable !== null} onClick={start}>
          <Plus />
          {starting
            ? t('components.rightSidebar.sideChat.starting', 'Starting…')
            : t('components.rightSidebar.sideChat.new', 'New side chat')}
        </Button>
        {reason ? (
          <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
            {reason}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t('components.rightSidebar.sideChat.slashHint', 'You can also type /side in the chat.')}
        </p>
      </div>
    </div>
  )
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
function DockedChatHeader({
  tab,
  newChat,
  onClose
}: {
  tab: Tab
  newChat: NewSideChat
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const title = useChatTabTitle(tab)
  const moveToCenter = t('components.native-chat.sideChat.moveToCenter', 'Move to center')
  const newLabel = newChat.starting
    ? t('components.rightSidebar.sideChat.starting', 'Starting…')
    : t('components.rightSidebar.sideChat.new', 'New side chat')
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
        aria-label={newLabel}
        disabled={newChat.starting}
        onClick={newChat.start}
      >
        <Plus />
        <span className="hidden @[27.5rem]:inline">
          {newChat.starting ? newLabel : t('components.rightSidebar.sideChat.newShort', 'New')}
        </span>
      </Button>
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
  const title = useChatTabTitle(tab)
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
  const newChat = useNewSideChat(worktreeId ?? '')

  if (!worktreeId || dockedTabs.length === 0) {
    return <SideChatStart newChat={newChat} />
  }
  const currentTab = dockedTabs.find((tab) => tab.id === currentTabId) ?? dockedTabs[0]
  return (
    <div className="@container flex min-h-0 flex-1 flex-col bg-muted" data-side-chat-panel="">
      <DockedChatHeader
        tab={currentTab}
        newChat={newChat}
        onClose={() => closeItem(currentTab.id)}
      />
      {newChat.error ? (
        <p className="shrink-0 px-3 pb-2 text-xs text-destructive" role="status">
          {newChat.error}
        </p>
      ) : null}
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
