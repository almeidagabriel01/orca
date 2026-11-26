import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
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

function DockedChatStripItem({
  tab,
  current,
  onSelect,
  onClose
}: {
  tab: Tab
  current: boolean
  onSelect: () => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const name = useStructuredChatTabConversationName(tab)
  const title = tab.customLabel?.trim() || name || tab.label
  const { activityStatus, programProgress } = useTerminalTabActivity({
    id: structuredAgentSessionAddressTabId(tab.id, tab.entityId),
    title: tab.label
  })
  const closeLabel = t('components.rightSidebar.sideChat.close', 'Close {{name}}', { name: title })
  return (
    <div
      className={cn(
        'flex h-6 min-w-0 max-w-full items-center rounded-md pl-1.5 text-xs text-muted-foreground hover:bg-accent',
        current && 'bg-accent text-foreground'
      )}
      data-current={current ? 'true' : undefined}
    >
      <button
        type="button"
        className="flex min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-current={current ? 'page' : undefined}
        onClick={onSelect}
      >
        <TerminalTabLeadingIcon
          agent={agentTypeToIconAgent(tab.agentSessionAgent)}
          activityStatus={activityStatus}
          shell={undefined}
          showUnreadActivity={false}
          isActive={current}
          progress={programProgress}
        />
        <span className="truncate">{title}</span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 shrink-0"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {closeLabel}
        </TooltipContent>
      </Tooltip>
    </div>
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
          'No side chats here. Type /btw in a chat to start one.'
        )}
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-side-chat-panel="">
      {/* Always drawn, so even one docked chat shows its name and status; wraps instead of scrolling. */}
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-2 py-1">
        {dockedTabs.map((tab) => (
          <DockedChatStripItem
            key={tab.id}
            tab={tab}
            current={tab.id === currentTabId}
            onSelect={() => selectTab(worktreeId, tab.id)}
            onClose={() => closeItem(tab.id)}
          />
        ))}
      </div>
      <div ref={registerBody} className="min-h-0 flex-1" style={BODY_ANCHOR_STYLE} />
    </div>
  )
}
