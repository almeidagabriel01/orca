import React, { useCallback, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { ChatAgentMemory } from '../../../../../../shared/diagnostics/process-stats-types'
import { MetricPair, ROW_TRAILING_GUTTER_CLS } from './resource-usage-metrics'
import { isResourceSessionActivationKey } from '../session-actions/resource-session-navigation'
import { parseExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { ProcessTreeToggle, SessionProcessTreeView } from './resource-usage-session-processes'

/** A workspace's chat rows; samples share each workspace's chat array, so unrelated updates skip them. */
export const ChatRows = React.memo(function ChatRows({
  chats,
  worktreeId,
  runtimeHostId,
  unplaced,
  workspacePath,
  onOpenChat
}: {
  chats: readonly ChatAgentMemory[]
  worktreeId: string
  runtimeHostId?: string
  workspacePath: string | null
  /** This window can't reach the workspace, so its chats are read-only. */
  unplaced?: true
  onOpenChat: (worktreeId: string, agentSessionId: string, runtimeHostId?: string) => void
}): React.JSX.Element {
  // Stable, so a chat whose values didn't change skips its render when another chat's do.
  const openChat = useCallback(
    (agentSessionId: string): void => onOpenChat(worktreeId, agentSessionId, runtimeHostId),
    [onOpenChat, worktreeId, runtimeHostId]
  )
  const open = unplaced ? undefined : openChat
  const host = parseExecutionHostId(runtimeHostId)
  const environmentId = host?.kind === 'runtime' ? host.environmentId : undefined
  return (
    <>
      {chats.map((chat) => (
        <ChatRow
          key={chat.agentSessionId}
          chat={chat}
          onOpen={open}
          environmentId={environmentId}
          workspacePath={workspacePath}
        />
      ))}
    </>
  )
})

/** A chat agent and the processes running under it; it stops from the chat, so the row has no kill action. */
const ChatRow = React.memo(function ChatRow({
  chat,
  onOpen,
  environmentId,
  workspacePath
}: {
  chat: ChatAgentMemory
  /** Absent when this window can't reach the chat's workspace, so the row is read-only. */
  onOpen?: (agentSessionId: string) => void
  /** The paired server that runs the chat, which answers for its processes. */
  environmentId?: string
  workspacePath: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const agent = isTuiAgent(chat.agent) ? chat.agent : null
  const agentLabel = agent ? getAgentLabel(agent) : chat.agent
  const open = onOpen ? (): void => onOpen(chat.agentSessionId) : undefined
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 pl-10 pr-3 py-1.5',
              open && 'cursor-pointer hover:bg-accent/40'
            )}
            onClick={open}
            role={open ? 'button' : undefined}
            tabIndex={0}
            onKeyDown={
              open
                ? (e) => {
                    if (isResourceSessionActivationKey(e.key)) {
                      e.preventDefault()
                      open()
                    }
                  }
                : undefined
            }
          >
            <ProcessTreeToggle
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
              className="-ml-6"
            />
            <AgentIcon agent={agent} size={12} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {chat.name?.trim() || agentLabel}
            </span>
            <MetricPair cpu={chat.cpu} memory={chat.memory} size="small" flagHeavy />
            <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[70]">
          {t(
            'resourceManager.chatRow.tooltip',
            '{{agent}} chat, including the processes running under it',
            { agent: agentLabel }
          )}
        </TooltipContent>
      </Tooltip>
      {expanded ? (
        <SessionProcessTreeView
          sessionId={chat.agentSessionId}
          environmentId={environmentId}
          workspacePath={workspacePath}
        />
      ) : null}
    </>
  )
})

/** Agent processes no single chat owns, such as a server several chats share. */
export function SharedAgentProcessesRow({
  usage
}: {
  usage: { cpu: number; memory: number }
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {t('resourceManager.sharedAgentProcesses', 'Shared agent processes')}
      </span>
      <MetricPair cpu={usage.cpu} memory={usage.memory} />
      <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
    </div>
  )
}
