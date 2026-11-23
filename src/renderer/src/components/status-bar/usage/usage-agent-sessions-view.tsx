import React, { createContext, useContext, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { AgentStateDot, type AgentDotState } from '@/components/agent/status/AgentStateDot'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useNow } from '@/lib/window-activity/use-now'
import { useAppStore } from '@/store/index'
import { getNotificationWorkspaceLabels } from '@/attention/notification-workspace-labels'
import { activateWorktreeAgentPane } from '@/components/sidebar/workspace-card/activity/use-worktree-agent-activation'
import { openResourceChat } from '@/components/status-bar/resources/session-actions/resource-session-navigation'
import { toRuntimeExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { formatCompactDuration } from '../../../../../shared/agent-status/presentation/agent-row-decay-state'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  countSessionStates,
  groupSessionsByWorkspace,
  type UsageAgentSession,
  type UsageSessionState
} from './usage-account-sessions'

const DOT_STATE: Record<UsageSessionState, AgentDotState> = {
  working: 'working',
  waiting: 'waiting',
  recent: 'done'
}

type UsageRowSessions = {
  sessions: readonly UsageAgentSession[]
  owner: RuntimeClientTarget | null
}

/** The agents of the usage row being drilled into, and the host they run on. */
const UsageRowSessionsContext = createContext<UsageRowSessions>({ sessions: [], owner: null })

/** Hands a row's agents to its details menu, however deep the switcher nests the panel. */
export function UsageRowSessionsScope({
  sessions,
  owner,
  children
}: UsageRowSessions & { children: React.ReactNode }): React.JSX.Element {
  const value = useMemo(() => ({ sessions, owner }), [sessions, owner])
  return (
    <UsageRowSessionsContext.Provider value={value}>{children}</UsageRowSessionsContext.Provider>
  )
}

export function formatSessionCounts(sessions: readonly UsageAgentSession[], t: Translate): string {
  const counts = countSessionStates(sessions)
  return [
    counts.working
      ? t('components.status-bar.usage.sessions.working', '{{count}} working', {
          count: counts.working
        })
      : null,
    counts.waiting
      ? t('components.status-bar.usage.sessions.waiting', '{{count}} waiting', {
          count: counts.waiting
        })
      : null
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Spins at the chip's corner while an agent works on its account; holds still when one waits. */
export function UsageChipActivity({
  sessions
}: {
  sessions: readonly UsageAgentSession[]
}): React.JSX.Element | null {
  const t = useTranslate()
  const state = sessions.some((session) => session.state === 'working')
    ? 'working'
    : sessions.some((session) => session.state === 'waiting')
      ? 'waiting'
      : null
  if (!state) {
    return null
  }
  return (
    <span
      data-usage-activity={state}
      aria-label={formatSessionCounts(sessions, t)}
      className="pointer-events-none absolute -left-0.5 -top-0.5 rounded-full bg-background"
    >
      <AgentStateDot state={DOT_STATE[state]} title={null} />
    </span>
  )
}

/** "2 working · 1 waiting" under a popover row whose account has live agents. */
export function UsageRowSessionCounts({
  sessions
}: {
  sessions: readonly UsageAgentSession[]
}): React.JSX.Element | null {
  const t = useTranslate()
  const label = formatSessionCounts(sessions, t)
  if (!label) {
    return null
  }
  const working = sessions.some((session) => session.state === 'working')
  return (
    <span
      data-usage-sessions=""
      className="flex items-center gap-1.5 pl-[30px] text-[11px] text-muted-foreground"
    >
      <AgentStateDot state={working ? 'working' : 'waiting'} title={null} />
      {label}
    </span>
  )
}

function openSession(session: UsageAgentSession, owner: RuntimeClientTarget | null): void {
  const target = session.open
  if (target.kind === 'pane') {
    activateWorktreeAgentPane(target.worktreeId, target.tabId, target.paneKey)
    return
  }
  void openResourceChat(
    target.workspaceId,
    target.sessionId,
    owner?.kind === 'environment' ? toRuntimeExecutionHostId(owner.environmentId) : undefined
  )
}

function SessionRow({
  session,
  owner,
  now
}: {
  session: UsageAgentSession
  owner: RuntimeClientTarget | null
  now: number
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <DropdownMenuItem
      data-usage-session={session.state}
      onSelect={() => openSession(session, owner)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <AgentStateDot state={DOT_STATE[session.state]} title={null} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-xs',
            session.state === 'recent' ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {session.title || t('components.status-bar.usage.sessions.untitled', 'Untitled chat')}
        </span>
        {session.model ? (
          <span className="max-w-28 shrink-0 truncate text-[11px] text-muted-foreground">
            {session.model}
          </span>
        ) : null}
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatCompactDuration(Math.max(0, now - session.since))}
        </span>
      </span>
    </DropdownMenuItem>
  )
}

// Why a snapshot: names change rarely, and a subscription per group would redraw on every store write.
function workspaceGroupLabel(workspaceId: string): string {
  const labels = getNotificationWorkspaceLabels(useAppStore.getState(), workspaceId)
  return [labels.repoLabel, labels.worktreeLabel].filter(Boolean).join(' · ')
}

function SessionGroups({
  sessions,
  owner,
  now
}: {
  sessions: readonly UsageAgentSession[]
  owner: RuntimeClientTarget | null
  now: number
}): React.JSX.Element {
  return (
    <>
      {groupSessionsByWorkspace(sessions).map((group) => {
        return (
          <div key={group.workspaceId} data-usage-session-workspace="">
            <div className="truncate px-3 pb-0.5 pt-1.5 text-[11px] text-muted-foreground">
              {workspaceGroupLabel(group.workspaceId)}
            </div>
            {group.sessions.map((session) => (
              <SessionRow key={session.key} session={session} owner={owner} now={now} />
            ))}
          </div>
        )
      })}
    </>
  )
}

/** The details panel's agents: live ones by workspace, the last hour's finished ones folded. */
export function UsageSessionList(): React.JSX.Element | null {
  const t = useTranslate()
  const { sessions, owner } = useContext(UsageRowSessionsContext)
  const now = useNow(30_000, sessions.length > 0)
  const [showRecent, setShowRecent] = useState(false)
  if (sessions.length === 0) {
    return null
  }
  const live = sessions.filter((session) => session.state !== 'recent')
  const recent = sessions.filter((session) => session.state === 'recent')
  return (
    <>
      <DropdownMenuSeparator />
      <div data-usage-session-list="" className="pb-1">
        <div className="flex items-baseline gap-2 px-3 pt-1.5">
          <span className="text-xs font-medium text-foreground">
            {t('components.status-bar.usage.sessions.heading', 'Agents')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatSessionCounts(sessions, t)}
          </span>
        </div>
        <SessionGroups sessions={live} owner={owner} now={now} />
        {recent.length > 0 ? (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setShowRecent((value) => !value)
              }}
              aria-expanded={showRecent}
            >
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ChevronRight
                  size={12}
                  className={cn('transition-transform', showRecent && 'rotate-90')}
                />
                {t(
                  'components.status-bar.usage.sessions.recent',
                  'Finished in the last hour ({{count}})',
                  {
                    count: recent.length
                  }
                )}
              </span>
            </DropdownMenuItem>
            {showRecent ? <SessionGroups sessions={recent} owner={owner} now={now} /> : null}
          </>
        ) : null}
      </div>
    </>
  )
}
