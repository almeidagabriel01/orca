import React, { createContext, useContext, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { AgentStateDot, type AgentDotState } from '@/components/agent/status/AgentStateDot'
import { AgentWorkingSpinner } from '@/components/agent/status/AgentWorkingSpinner'
import { ProviderIcon } from './provider-usage-panel'
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
const UsageRowSessionsContext = createContext<UsageRowSessions>({
  sessions: [],
  owner: null
})

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

export type UsageActivity = 'working' | 'waiting'

/** What an account's agents are doing, for the ring around its icon: working wins over waiting. */
export function getUsageActivity(sessions: readonly UsageAgentSession[]): UsageActivity | null {
  return sessions.some((session) => session.state === 'working')
    ? 'working'
    : sessions.some((session) => session.state === 'waiting')
      ? 'waiting'
      : null
}

/** Half a ring turning on a faint track, in Orca's working yellow: an agent is working. */
function WorkingArc({ className }: { className?: string }): React.JSX.Element {
  return (
    <AgentWorkingSpinner
      className={cn(
        'border-agent-working-ring/20 border-t-agent-working-ring border-r-agent-working-ring motion-reduce:border-t-agent-working-ring',
        className
      )}
    />
  )
}

/** A session's state mark: the chip's arc while working, the usual glyphs otherwise. */
function SessionStateMark({ state }: { state: UsageSessionState }): React.JSX.Element {
  return state === 'working' ? (
    <span className="inline-flex size-3 shrink-0 items-center justify-center">
      <WorkingArc className="size-3 border-[1.5px]" />
    </span>
  ) : (
    <AgentStateDot state={DOT_STATE[state]} title={null} />
  )
}

/**
 * Glyph size inside the 18px ring box (14px inside its 2px stroke), leaving 2px clear around the
 * painted logo. Logos on a filled square tile reach the ring with their corners, and taller-than-
 * wide ones with their ends, so they step down until the corners clear it too.
 */
const RING_ICON_SIZE: Partial<Record<string, number>> = {
  claude: 9,
  codex: 9,
  minimax: 7,
  'opencode-go': 6,
  kimi: 7,
  antigravity: 7,
  grok: 7,
  zcode: 7,
  muse: 7,
  cursor: 7
}

/**
 * The provider icon in a square box with its activity ring: half a ring turning while an agent
 * works, a still closed ring while one waits. Box, ring and glyph share one center (grid
 * place-items), and the box is the same size idle or busy, so the bar's measured width holds.
 */
export function UsageActivityRing({
  provider,
  sessions
}: {
  provider: string
  sessions: readonly UsageAgentSession[] | undefined
}): React.JSX.Element {
  const t = useTranslate()
  if (!sessions) {
    return <ProviderIcon provider={provider} />
  }
  const activity = getUsageActivity(sessions)
  return (
    <span
      data-usage-activity={activity ?? 'idle'}
      role={activity ? 'img' : undefined}
      aria-label={activity ? formatSessionCounts(sessions, t) : undefined}
      className="relative grid size-[18px] shrink-0 place-items-center"
    >
      <ProviderIcon provider={provider} size={RING_ICON_SIZE[provider] ?? 9} />
      {activity === 'working' ? (
        <WorkingArc className="pointer-events-none absolute inset-0 border-2" />
      ) : activity === 'waiting' ? (
        // Why a closed ring: still and whole reads apart from the turning arc, even frozen.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-foreground/45"
        />
      ) : null}
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
      <SessionStateMark state={working ? 'working' : 'waiting'} />
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
        <SessionStateMark state={session.state} />
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
