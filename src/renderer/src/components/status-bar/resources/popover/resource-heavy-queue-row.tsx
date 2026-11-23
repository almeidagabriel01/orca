import React, { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Hourglass,
  MoreHorizontal,
  Play,
  X,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyQueueAction } from '../../../../../../shared/rpc-contract/diagnostics-params'
import type { HeavyQueueRow } from './resource-heavy-queue-view'
import { formatElapsed } from './resource-session-processes'
import { CopyCommand } from './resource-usage-session-processes'

export type RunAction = (action: HeavyQueueAction, failure: (message: string) => string) => void

export function QueueAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled: boolean
  destructive?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost-inset"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={cn(
            'size-5 text-muted-foreground',
            destructive && 'hover:bg-destructive/10 hover:text-destructive'
          )}
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

/** The moves a waiting row offers, always visible; a row the host does not order offers only removal. */
function RowActions({
  row,
  pending,
  run,
  onConfirm
}: {
  row: HeavyQueueRow
  pending: boolean
  run: RunAction
  onConfirm: (kind: 'start' | 'remove') => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const { pid } = row.job
  if (!row.can.remove && !row.can.startNow) {
    return null
  }
  const moveFailed = (message: string): string =>
    t('resourceManager.heavyQueue.moveFailed', "Couldn't move it. {{value0}}", { value0: message })
  const move = (to: 'up' | 'down' | 'top' | 'bottom'): void =>
    run({ action: 'move', pid, to }, moveFailed)
  const labels = {
    up: t('resourceManager.heavyQueue.moveUp', 'Move up'),
    down: t('resourceManager.heavyQueue.moveDown', 'Move down'),
    next: t('resourceManager.heavyQueue.runNext', 'Run next'),
    end: t('resourceManager.heavyQueue.moveToEnd', 'Move to end'),
    start: t('resourceManager.heavyQueue.startNow', 'Start now…'),
    remove: t('resourceManager.heavyQueue.remove', 'Remove from queue…')
  }
  const runNext = (): void => run({ action: 'run-now', pid, extra: false }, moveFailed)
  return (
    <>
      {/* Why two forms: a wide card shows every move on the row; a narrow one folds them into one
          menu so the workspace and command keep the width. */}
      <div className="hidden shrink-0 items-center @[24rem]/queue:flex">
        {/* Why invisible, not absent: a row outside the host's order keeps its Remove in the same column. */}
        <div className={cn('flex items-center', !row.can.startNow && 'invisible')}>
          <QueueAction
            label={labels.up}
            icon={ArrowUp}
            disabled={pending || !row.can.moveUp}
            onClick={() => move('up')}
          />
          <QueueAction
            label={labels.down}
            icon={ArrowDown}
            disabled={pending || !row.can.moveDown}
            onClick={() => move('down')}
          />
          <QueueAction
            label={labels.next}
            icon={ArrowUpToLine}
            disabled={pending || !row.can.runNext}
            onClick={runNext}
          />
          <QueueAction
            label={labels.end}
            icon={ArrowDownToLine}
            disabled={pending || !row.can.moveToEnd}
            onClick={() => move('bottom')}
          />
          <QueueAction
            label={labels.start}
            icon={Zap}
            disabled={pending}
            onClick={() => onConfirm('start')}
          />
        </div>
        <QueueAction
          label={labels.remove}
          icon={X}
          disabled={pending}
          destructive
          onClick={() => onConfirm('remove')}
        />
      </div>
      <div className="@[24rem]/queue:hidden">
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost-inset"
                  disabled={pending}
                  aria-label={t('resourceManager.heavyQueue.actions', 'Queue actions')}
                  className="size-5 text-muted-foreground"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {t('resourceManager.heavyQueue.actions', 'Queue actions')}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-40">
            {row.can.startNow && (
              <>
                <DropdownMenuItem disabled={!row.can.moveUp} onSelect={() => move('up')}>
                  <ArrowUp />
                  {labels.up}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!row.can.moveDown} onSelect={() => move('down')}>
                  <ArrowDown />
                  {labels.down}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!row.can.runNext} onSelect={runNext}>
                  <ArrowUpToLine />
                  {labels.next}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!row.can.moveToEnd} onSelect={() => move('bottom')}>
                  <ArrowDownToLine />
                  {labels.end}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onConfirm('start')}>
                  <Zap />
                  {labels.start}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => onConfirm('remove')}>
              <X />
              {labels.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

export function QueueRow({
  row,
  hostLabel,
  pending,
  run
}: {
  row: HeavyQueueRow
  hostLabel: string
  pending: boolean
  run: RunAction
}): React.JSX.Element {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const [confirm, setConfirm] = useState<'start' | 'remove' | null>(null)
  const { job } = row
  const running = job.status === 'running'
  const Icon = running ? Play : Hourglass
  const where = running
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
    } else if (confirm === 'start') {
      run({ action: 'run-now', pid: job.pid, extra: true }, (message) =>
        t('resourceManager.heavyQueue.startFailed', "Couldn't start it. {{value0}}", {
          value0: message
        })
      )
    }
  }
  return (
    <li className="group/procrow py-1 pl-3 pr-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 [grid-template-areas:'main_actions'_'cmd_cmd']">
        <div className="flex min-h-5 min-w-0 items-center gap-1.5 text-2xs text-muted-foreground [grid-area:main]">
          <Icon
            className={cn('size-3 shrink-0', running && 'fill-current text-foreground')}
            aria-hidden
          />
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
          {/* Why rtl: a long path loses its start (…/apps/web), never the folder that names it. */}
          <span
            className="min-w-0 flex-1 truncate text-left font-medium text-foreground [direction:rtl]"
            title={job.cwd}
          >
            <bdi dir="ltr">{row.place}</bdi>
          </span>
        </div>
        <div className="[grid-area:actions]">
          <RowActions row={row} pending={pending} run={run} onConfirm={setConfirm} />
        </div>
        <div className="flex min-w-0 items-start gap-1 pl-[1.125rem] [grid-area:cmd]">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-description={
                  expanded
                    ? t('resourceManager.heavyQueue.collapseCommand', 'Show less of the command')
                    : t('resourceManager.heavyQueue.expandCommand', 'Show the whole command')
                }
                className={cn(
                  'min-w-0 flex-1 rounded-sm text-left font-mono text-3xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // Two lines before it cuts; a click shows all of it.
                  expanded ? 'whitespace-pre-wrap break-all' : 'line-clamp-2 break-all'
                )}
              >
                {job.command}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-80 font-mono break-all">
              {job.command}
            </TooltipContent>
          </Tooltip>
          <CopyCommand command={job.command} />
        </div>
      </div>
      {confirm && (
        <div
          role="group"
          className="mt-1 ml-[1.125rem] flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1"
        >
          <span className="mr-auto text-2xs text-foreground">
            {confirm === 'remove'
              ? t(
                  'resourceManager.heavyQueue.removeQuestion',
                  'Remove from the queue? The command stops waiting and fails.'
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
            variant={confirm === 'remove' ? 'destructive' : 'default'}
            disabled={pending}
            onClick={confirmRun}
          >
            {confirm === 'remove'
              ? t('resourceManager.heavyQueue.removeConfirm', 'Remove')
              : t('resourceManager.heavyQueue.startConfirm', 'Start now')}
          </Button>
        </div>
      )}
    </li>
  )
}
