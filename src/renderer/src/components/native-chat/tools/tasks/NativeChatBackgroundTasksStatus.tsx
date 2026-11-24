import { useTranslate } from '@/i18n/use-translate'
import { workerDockKindLabel } from './dock/worker-dock-labels'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentSessionBackgroundTask } from '../../../../../../shared/agent-session/background-tasks/agent-session-background-task-wire'
import type {
  AgentChildRowContext,
  AgentChildRowModel
} from '../../../../../../shared/agent-status/presentation/agent-child-row-model'
import type { AgentChildWorkView } from '../../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import {
  agentChildRowName,
  agentChildRowDetailText
} from '@/components/agent/status/agent-child-row-text'
import { compareWorkerDockEntries } from '../../../../../../shared/orchestration/dock/worker-dock'
import { backgroundTaskRowStopId } from '../../../../../../shared/agent-status/presentation/background-tasks/background-task-roster'
import { structuredSessionBackgroundTaskGroups } from './background-task-roster'
import { useWorkerDockStructuralValue } from './dock/NativeChatWorkerDockFrame'
import { WorkerDockRoster } from './dock/WorkerDockRoster'
import type { WorkerDockRowView } from './dock/WorkerDockRow'
import {
  dismissWorkerDockRows,
  restoreWorkerDockRows,
  toastWorkerDockDismissed,
  useDismissedWorkerDockRows,
  type WorkerDockLocalDismissal,
  withoutDismissedWorkerDockRows,
  workerDockLocallyDismissible
} from './dock/worker-dock-dismissals'

/** Use strip width in rem so narrow splits behave like narrow windows even on wide monitors. */
const NARROW_STRIP_REM = 27.5

function rootFontSizePx(): number {
  const parsed = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16
}

/** Measure the strip itself; viewport width is only the initial fallback. */
function useStripLayout(ref: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState(() => ({
    narrow: window.innerWidth < NARROW_STRIP_REM * 16,
    compact: window.innerHeight < 520
  }))
  useEffect(() => {
    const root = ref.current
    const element = root?.closest('[data-native-chat-worker-dock]') ?? root
    const pane = root?.closest('[data-native-chat-root]')
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const measure = () => {
      const narrow = element.getBoundingClientRect().width < NARROW_STRIP_REM * rootFontSizePx()
      const compact = (pane?.getBoundingClientRect().height ?? window.innerHeight) < 520
      setLayout((previous) =>
        previous.narrow === narrow && previous.compact === compact ? previous : { narrow, compact }
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (pane) {
      observer.observe(pane)
    }
    measure()
    return () => observer.disconnect()
  }, [ref])
  return layout
}

function workerChildren(row: AgentChildRowModel): AgentChildRowModel[] {
  return [row, ...row.owned.flatMap(workerChildren)]
}

// The key names the ending too, so work that runs and ends again shows until dismissed again.
function withWorkerDismissKey<
  T extends {
    id: string
    state: WorkerDockRowView['state']
    settlement?: string | null
    changedAt: number | null
    ownerActionsAvailable?: boolean
  }
>(row: T): T & { dismissKey?: string } {
  return workerDockLocallyDismissible(row)
    ? { ...row, dismissKey: `${row.id}\0${row.settlement ?? row.changedAt ?? ''}` }
    : row
}

function providerDismissKey(
  sessionId: string | undefined,
  row: AgentChildRowModel,
  state: WorkerDockRowView['state']
): string | undefined {
  return workerDockLocallyDismissible({ state, finished: row.settled })
    ? `${sessionId ?? ''}\0${row.kind}\0${row.id}\0${row.settledAt ?? ''}`
    : undefined
}

// Ended work reads as idle, not running: its row draws it finished (retired) and the header never counts it.
function providerDockState(row: AgentChildRowModel): WorkerDockRowView['state'] {
  return row.displayState === 'failed'
    ? 'failed'
    : row.displayState === 'interrupted'
      ? 'unexpected'
      : row.displayState === 'idle' || row.displayState === 'done'
        ? 'idle'
        : row.displayState === 'unverifiable'
          ? 'unavailable'
          : row.displayState === 'waiting' || row.displayState === 'blocked'
            ? 'coordinator'
            : 'running'
}

export function NativeChatBackgroundTasksStatus(liveProps: {
  tasks: readonly AgentSessionBackgroundTask[]
  settledTasks: readonly AgentSessionBackgroundTask[]
  /** The host's child views, when it publishes them; rows then read these instead of the tasks. */
  childViews?: readonly AgentChildWorkView[]
  /** Use the sidebar’s parent context to qualify child state; without it, trust reported live claims. */
  childRowContext?: AgentChildRowContext
  supportsTaskStop: boolean
  /** Offer untargeted Stop only when the provider can perform it. */
  offersStopAll: boolean
  /** Some running work is not listed, so the rows are not the whole roster. */
  incomplete?: boolean
  stoppingTaskIds: ReadonlySet<string>
  stoppingAll: boolean
  /** Let monitoring speak only when idle; a running turn owns the indicator. */
  indicatorActive: boolean
  isVisible: boolean
  /** Parent-owned expansion survives temporary empty rosters, which unmount this strip and flush settled rows. */
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onStop: (taskId?: string) => void
  /** Open a listed agent's own view. */
  onShowAgent?: (providerId: string) => void
  onShowProviderDetails?: (row: WorkerDockRowView, opener: HTMLElement) => void
  /** The agent whose view the pane shows. */
  currentAgentId?: string | null
  workerRows?: ReadonlyMap<string, WorkerDockRowView>
  workerIdentities?: readonly {
    id: string
    state: WorkerDockRowView['state']
    changedAt: number | null
    settlement: string | null
    ownerActionsAvailable: boolean
  }[]
  sessionId?: string
  onOpenWorker?: (row: WorkerDockRowView, opener: HTMLElement) => void
  onWorkerAction?: (row: WorkerDockRowView, action: 'stop' | 'clear') => void
  onClearAll?: (local?: WorkerDockLocalDismissal) => void
  loadWindow?: (anchor: string) => Promise<void>
}): React.JSX.Element {
  const t = useTranslate()
  const dismissed = useDismissedWorkerDockRows()
  const props = useWorkerDockStructuralValue(liveProps)
  const root = useRef<HTMLDivElement>(null)
  const { narrow, compact } = useStripLayout(root)
  const groups = useMemo(
    () =>
      structuredSessionBackgroundTaskGroups(
        props.tasks,
        props.settledTasks,
        props.childViews,
        props.childRowContext
      ),
    [props.tasks, props.settledTasks, props.childViews, props.childRowContext]
  )
  const holdingStructure = props !== liveProps
  const countGroups = useMemo(
    () =>
      holdingStructure
        ? structuredSessionBackgroundTaskGroups(
            liveProps.tasks,
            liveProps.settledTasks,
            liveProps.childViews,
            liveProps.childRowContext
          )
        : groups,
    [
      holdingStructure,
      liveProps.tasks,
      liveProps.settledTasks,
      liveProps.childViews,
      liveProps.childRowContext,
      groups
    ]
  )
  const countIdentities = useMemo(
    () =>
      withoutDismissedWorkerDockRows(
        [
          ...(liveProps.workerIdentities ?? []).map(withWorkerDismissKey),
          ...countGroups.flatMap((group) =>
            group.tasks
              .flatMap(({ row }) => workerChildren(row))
              .map((row) => {
                const state =
                  row.displayState === 'failed'
                    ? ('failed' as const)
                    : row.displayState === 'interrupted'
                      ? ('unexpected' as const)
                      : row.displayState === 'unverifiable'
                        ? ('unavailable' as const)
                        : row.displayState === 'done'
                          ? ('idle' as const)
                          : ('running' as const)
                return {
                  id: `${row.kind}:${row.id}`,
                  kind: row.kind,
                  state,
                  dismissKey: providerDismissKey(liveProps.sessionId, row, providerDockState(row))
                }
              })
          )
        ],
        dismissed
      ),
    [liveProps.workerIdentities, liveProps.sessionId, countGroups, dismissed]
  )
  const providerRows = useMemo(() => {
    const views = new Map(props.childViews?.map((view) => [view.id, view]))
    return groups.flatMap((group) =>
      group.tasks
        .flatMap(({ row }) => workerChildren(row))
        .map((row): WorkerDockRowView => {
          const view = views.get(row.id)
          const state = providerDockState(row)
          const dismissKey = providerDismissKey(props.sessionId, row, state)
          return {
            ...(dismissKey ? { dismissKey } : {}),
            ...(row.displayState === 'done' ? { retired: true } : {}),
            id: JSON.stringify([
              props.sessionId ?? '',
              row.kind,
              view
                ? `${row.id}:${view.invocation.invocationId}:${view.invocation.generation}`
                : row.id
            ]),
            dispatchId: row.id,
            source: props.sessionId ?? '',
            kind: row.kind,
            name: view?.name ?? row.agentType ?? workerDockKindLabel(t, row.kind),
            title:
              view?.description ??
              agentChildRowName(row) ??
              agentChildRowDetailText(row, Date.now()),
            model: row.model ?? null,
            state,
            changedAt: view?.settledAt ?? row.firstObservedAt ?? null,
            startedAt: row.firstObservedAt || null,
            reason:
              state === 'failed' || state === 'unexpected' ? (view?.lastMessage ?? null) : null,
            settlement: null,
            resultId: null,
            stoppable: backgroundTaskRowStopId(row, props.supportsTaskStop) !== null,
            providerId: row.providerId,
            // Stopped through this chat's own session, which a remote chat reaches too; only
            // orchestration workers carry the desktop-local owner gate.
            ownerActionsAvailable: true
          }
        })
    )
  }, [groups, props.childViews, props.sessionId, props.supportsTaskStop, t])
  const rows = useMemo(
    () =>
      new Map([
        ...[...(props.workerRows ?? [])].map(
          ([id, row]) => [id, withWorkerDismissKey(row)] as const
        ),
        ...providerRows.map((row) => [row.id, row] as const)
      ]),
    [props.workerRows, providerRows]
  )
  const identities = useMemo(
    () =>
      withoutDismissedWorkerDockRows(
        [...(props.workerIdentities ?? []).map(withWorkerDismissKey), ...providerRows],
        dismissed
      ).sort(compareWorkerDockEntries),
    [props.workerIdentities, providerRows, dismissed]
  )
  return (
    <div ref={root} className="min-h-0">
      <WorkerDockRoster
        rows={rows}
        identities={identities}
        countIdentities={countIdentities}
        narrow={narrow}
        compact={compact}
        visible={props.isVisible}
        incomplete={props.incomplete}
        stopAll={
          props.offersStopAll
            ? { pending: props.stoppingAll, onStop: () => props.onStop() }
            : undefined
        }
        // Open or closed is the user's own choice, never part of the structure a gesture holds:
        // the toggle always reads and sets the live value.
        expanded={liveProps.expanded}
        onExpandedChange={liveProps.onExpandedChange}
        pending={
          new Set([
            ...props.stoppingTaskIds,
            ...[...rows.values()]
              .filter((row) => row.providerId && props.stoppingTaskIds.has(row.providerId))
              .map((row) => row.id)
          ])
        }
        onOpen={(row, opener) => {
          if (row.kind === 'worker') {
            props.onOpenWorker?.(row, opener)
          } else if (row.kind === 'command' || row.settlement) {
            props.onShowProviderDetails?.(row, opener)
          } else if (row.providerId) {
            props.onShowAgent?.(row.providerId)
          }
        }}
        onAction={(row, action) => {
          if (action === 'dismiss') {
            const keys = row.dismissKey ? [row.dismissKey] : []
            if (keys.length) {
              dismissWorkerDockRows(keys)
              toastWorkerDockDismissed(t, 1, () => restoreWorkerDockRows(keys))
            }
          } else if (row.kind === 'worker' || action === 'clear') {
            props.onWorkerAction?.(row, action)
          } else if (action === 'stop' && row.providerId) {
            props.onStop(row.providerId)
          }
        }}
        onClearAll={() => {
          const keys = identities.flatMap((row) => row.dismissKey ?? [])
          dismissWorkerDockRows(keys)
          const local = keys.length
            ? { count: keys.length, undo: () => restoreWorkerDockRows(keys) }
            : undefined
          if (props.onClearAll) {
            props.onClearAll(local)
          } else if (local) {
            toastWorkerDockDismissed(t, local.count, local.undo)
          }
        }}
        loadWindow={props.loadWindow}
      />
    </div>
  )
}
