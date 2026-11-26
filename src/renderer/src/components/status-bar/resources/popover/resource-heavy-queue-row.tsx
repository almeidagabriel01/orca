import type React from 'react'
import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { ArrowRight, Hourglass, Play, X, Zap, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyQueueAction } from '../../../../../../shared/rpc-contract/diagnostics-params'
import type { HeavyQueueRow } from './resource-heavy-queue-view'
import { formatElapsed } from './resource-session-processes'
import { CopyCommand } from './resource-usage-session-processes'
import { QueueRowMenu, type ConfirmKind } from './resource-heavy-queue-row-menu'
import type { HeavyMoveHost } from './resource-heavy-job-move'
import type { HeavyJobMoveRequest } from './resource-heavy-queue-move-items'
import { QueueRowHostNote } from './resource-heavy-queue-host-note'
import { MetricPair } from './resource-usage-metrics'
import { MiddleEllipsisLabel } from '@/components/new-workspace/run-target/MiddleEllipsisLabel'

/** What a row needs to offer "Run on <host>"; source is null when this host's queue can't move jobs. */
export type RowMoveHosts = {
  source: HeavyMoveHost | null
  targets: readonly HeavyMoveHost[]
  onMoveHost: (pid: number) => HeavyJobMoveRequest
}

/** A command short enough to name in a question. */
function shortCommand(command: string): string {
  return command.length > 60 ? `${command.slice(0, 59)}…` : command
}

/** A sortable waiter's handle and drop line; plain rows get none. */
export type QueueRowDrag = {
  rowRef: Ref<HTMLLIElement>
  rowStyle: CSSProperties
  grip: ReactNode
  dragging: boolean
  insertion: 'before' | 'after' | undefined
}

export type RunAction = (action: HeavyQueueAction, failure: (message: string) => string) => void

export function QueueAction({
  label,
  icon: Icon,
  onClick,
  disabled
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="muted-field-icon"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className="size-5"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Wide cards show start now and remove as icons; every row keeps the ⋯ menu. Moving is drag or Alt+Up/Down. */
function RowActions({
  hostId,
  row,
  pending,
  onConfirm,
  moveHosts
}: {
  hostId: string
  row: HeavyQueueRow
  pending: boolean
  onConfirm: (kind: ConfirmKind) => void
  moveHosts: RowMoveHosts
}): React.JSX.Element {
  const t = useTranslate()
  const { pid } = row.job
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Why invisible, not absent: rows without these actions keep their ⋯ in the same column. */}
      <div className="hidden items-center @[24rem]/queue:flex">
        <div className={cn('flex items-center', !row.can.startNow && 'invisible')}>
          <QueueAction
            label={t('resourceManager.heavyQueue.startNow', 'Start now…')}
            icon={Zap}
            disabled={pending}
            onClick={() => onConfirm('start')}
          />
        </div>
        <div className={cn(!row.can.remove && 'invisible')}>
          <QueueAction
            label={t('resourceManager.heavyQueue.remove', 'Remove from queue…')}
            icon={X}
            disabled={pending}
            onClick={() => onConfirm('remove')}
          />
        </div>
      </div>
      <QueueRowMenu
        hostId={hostId}
        row={row}
        pending={pending}
        onConfirm={onConfirm}
        moveSource={moveHosts.source}
        moveTargets={moveHosts.targets}
        onMoveHost={moveHosts.onMoveHost(pid)}
      />
    </div>
  )
}

export function QueueRow({
  hostId,
  row,
  hostLabel,
  pending,
  run,
  moveHosts,
  drag,
  onStep
}: {
  hostId: string
  row: HeavyQueueRow
  hostLabel: string
  pending: boolean
  run: RunAction
  moveHosts: RowMoveHosts
  drag?: QueueRowDrag
  /** Alt+Up / Alt+Down anywhere in a sortable row moves it one place. */
  onStep?: (delta: -1 | 1) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const { job } = row
  const running = job.status === 'running'
  const moved = job.status === 'moved'
  const Icon = running ? Play : moved ? ArrowRight : Hourglass
  const where = moved
    ? t('resourceManager.heavyQueue.moved', 'Moved')
    : running
      ? job.extra
        ? t('resourceManager.heavyQueue.extraSlot', 'Extra slot')
        : job.slot !== null
          ? t('resourceManager.heavyQueue.slot', 'Slot {{value0}}', { value0: job.slot })
          : t('resourceManager.heavyQueue.running', 'Running')
      : t('resourceManager.heavyQueue.position', '#{{value0}}', { value0: row.position })
  const elapsed = formatElapsed(row.elapsedMs)
  const confirmRun = (): void => {
    setConfirm(null)
    if (confirm === 'remove') {
      run({ action: 'cancel', pid: job.pid }, (message) =>
        t('resourceManager.heavyQueue.removeFailed', "Couldn't remove it. {{value0}}", {
          value0: message
        })
      )
    } else if (confirm === 'stop') {
      run({ action: 'stop', pid: job.pid }, (message) =>
        t('resourceManager.heavyQueue.stopFailed', "Couldn't stop it. {{value0}}", {
          value0: message
        })
      )
    } else if (confirm === 'start') {
      run({ action: 'run-now', pid: job.pid, extra: true }, (message) =>
        t('resourceManager.heavyQueue.startFailed', "Couldn't start it. {{value0}}", {
          value0: message
        })
      )
    }
  }
  return (
    <li
      data-queue-row
      ref={drag?.rowRef}
      style={drag?.rowStyle}
      onKeyDown={(event) => {
        // Why contains: keys from the portaled ⋯ menu bubble here through React.
        const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        if (
          !onStep ||
          !event.altKey ||
          !step ||
          !event.currentTarget.contains(event.target as Node)
        ) {
          return
        }
        event.preventDefault()
        if (pending) {
          return
        }
        const focused = document.activeElement
        onStep(step)
        // React moves this node to its new place, which drops focus on the way down.
        requestAnimationFrame(() => focused instanceof HTMLElement && focused.focus())
      }}
      className={cn(
        'group/procrow relative py-1 pl-3 pr-2',
        drag?.dragging && 'rounded-md bg-accent shadow-xs'
      )}
    >
      {drag?.insertion && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-primary',
            drag.insertion === 'before' ? 'top-0' : 'bottom-0'
          )}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 [grid-template-areas:'main_actions'_'place_place'_'cmd_cmd']">
        <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-x-1.5 text-2xs text-muted-foreground [grid-area:main]">
          {drag?.grip ?? (
            <Icon
              className={cn('size-3 shrink-0', running && 'fill-current text-foreground')}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'w-14 shrink-0 truncate tabular-nums @[24rem]/queue:w-[4.25rem]',
              running ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {where}
          </span>
          {row.elapsedFromQueue ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-12 shrink-0 cursor-default tabular-nums">≤ {elapsed}</span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="max-w-64">
                {t(
                  'resourceManager.heavyQueue.directElapsed',
                  'Started through flock directly, so this counts from when it asked for the slot.'
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="w-12 shrink-0 tabular-nums">{elapsed}</span>
          )}
          {job.direct && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 cursor-default rounded-sm border border-border px-1 text-3xs leading-4 text-muted-foreground">
                  {t('resourceManager.heavyQueue.direct', 'flock')}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="max-w-64">
                {t(
                  'resourceManager.heavyQueue.directTooltip',
                  'Started through flock directly, outside the queue order: it cannot be moved, only removed while it waits.'
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2 [grid-area:place]">
          <div
            data-queue-place
            className="flex min-w-0 flex-1 pl-[1.125rem] text-2xs font-medium text-foreground"
            title={job.cwd}
          >
            <MiddleEllipsisLabel text={row.place} />
          </div>
          {/* pr-1 lines the columns up with the sections below, whose rows pad 4px more. */}
          {job.cpu !== undefined && job.memory !== undefined && (
            <div className="pr-1">
              <MetricPair cpu={job.cpu} memory={job.memory} size="small" flagHeavy />
            </div>
          )}
        </div>
        <div className="[grid-area:actions]">
          <RowActions
            hostId={hostId}
            row={row}
            pending={pending}
            onConfirm={setConfirm}
            moveHosts={moveHosts}
          />
        </div>
        <div className="flex min-w-0 items-start gap-1 pl-[1.125rem] [grid-area:cmd]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-queue-command
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-description={
                  expanded
                    ? t('resourceManager.heavyQueue.collapseCommand', 'Show less of the command')
                    : t('resourceManager.heavyQueue.expandCommand', 'Show the whole command')
                }
                className={cn(
                  'min-w-0 flex-1 rounded-sm text-left font-mono text-3xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // One line before it cuts; a click shows all of it.
                  expanded ? 'whitespace-pre-wrap break-words' : 'truncate'
                )}
              >
                {job.command}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-80 break-all">
              <span className="font-mono">{job.command}</span>
            </TooltipContent>
          </Tooltip>
          <CopyCommand command={job.command} />
        </div>
      </div>
      <QueueRowHostNote hostId={hostId} hostLabel={hostLabel} job={job} />
      {confirm && (
        <div
          role="group"
          className="mt-1 ml-[1.125rem] flex flex-wrap items-center justify-end gap-1.5 rounded-md bg-muted/60 px-2 py-1"
        >
          {/* Why wrap: on a narrow card the buttons drop below the question instead of leaving the card. */}
          <span className="min-w-[12rem] flex-1 text-2xs text-foreground">
            {confirm === 'remove'
              ? t(
                  'resourceManager.heavyQueue.removeQuestion',
                  'Remove from the queue? The command stops waiting and fails.'
                )
              : confirm === 'stop'
                ? t(
                    'resourceManager.heavyQueue.stopQuestion',
                    'Stop {{value0}}? The worker that started it gets an error.',
                    { value0: shortCommand(job.command) }
                  )
                : t(
                    'resourceManager.heavyQueue.startQuestion',
                    'Start now in an extra slot? It runs beside the busy slots, even if {{value0}} is loaded.',
                    { value0: hostLabel }
                  )}
          </span>
          <Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>
            {t('resourceManager.heavyQueue.keep', 'Keep')}
          </Button>
          <Button
            size="xs"
            variant={confirm === 'start' ? 'default' : 'destructive'}
            disabled={pending}
            onClick={confirmRun}
          >
            {confirm === 'remove'
              ? t('resourceManager.heavyQueue.removeConfirm', 'Remove')
              : confirm === 'stop'
                ? t('resourceManager.heavyQueue.stopConfirm', 'Stop')
                : t('resourceManager.heavyQueue.startConfirm', 'Start now')}
          </Button>
        </div>
      )}
    </li>
  )
}
