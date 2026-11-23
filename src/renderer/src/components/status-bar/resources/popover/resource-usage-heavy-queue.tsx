import React, { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Hourglass,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  X,
  Zap
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
import type { HeavyCommandQueue } from '../../../../../../shared/diagnostics/process-stats-types'
import type { HeavyQueueAction } from '../../../../../../shared/rpc-contract/diagnostics-params'
import type { ResourceHostSummary } from './resource-host-summary'
import { ResourceHostSection } from './resource-host-section'
import { buildHeavyQueueView, type HeavyQueueRow } from './resource-heavy-queue-view'
import { useHeavyQueueActions } from './resource-heavy-queue-actions'
import { formatElapsed } from './resource-session-processes'
import { CopyCommand } from './resource-usage-session-processes'

// Like the other host sections' collapse state, kept while Orca runs, across popover opens.
const collapsedHosts = new Set<string>()
/** The Resource Manager offers up to this many slots; a host set higher by hand keeps its number. */
const MAX_OFFERED_SLOTS = 3

type RunAction = (action: HeavyQueueAction, failure: (message: string) => string) => void

function RowMenu({
  row,
  pending,
  run,
  onConfirm
}: {
  row: HeavyQueueRow
  pending: boolean
  run: RunAction
  onConfirm: (kind: 'start' | 'remove') => void
}): React.JSX.Element {
  const t = useTranslate()
  const { pid } = row.job
  const moveFailed = (message: string): string =>
    t('resourceManager.heavyQueue.moveFailed', "Couldn't move it. {{value0}}", { value0: message })
  const move = (to: 'up' | 'down' | 'top' | 'bottom'): void =>
    run({ action: 'move', pid, to }, moveFailed)
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={t('resourceManager.heavyQueue.actions', 'Queue actions')}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <MoreHorizontal className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {row.can.startNow && (
          <>
            <DropdownMenuItem
              disabled={!row.can.runNext}
              onSelect={() => run({ action: 'run-now', pid, extra: false }, moveFailed)}
            >
              <ArrowUpToLine />
              {t('resourceManager.heavyQueue.runNext', 'Run next')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!row.can.moveUp} onSelect={() => move('up')}>
              <ArrowUp />
              {t('resourceManager.heavyQueue.moveUp', 'Move up')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!row.can.moveDown} onSelect={() => move('down')}>
              <ArrowDown />
              {t('resourceManager.heavyQueue.moveDown', 'Move down')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!row.can.moveToEnd} onSelect={() => move('bottom')}>
              <ArrowDownToLine />
              {t('resourceManager.heavyQueue.moveToEnd', 'Move to end')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onConfirm('start')}>
              <Zap />
              {t('resourceManager.heavyQueue.startNow', 'Start now…')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onSelect={() => onConfirm('remove')}>
          <X />
          {t('resourceManager.heavyQueue.remove', 'Remove from queue…')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function QueueRow({
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
  const hasMenu = row.can.remove || row.can.startNow
  return (
    <div className="group/procrow px-3 py-1.5 pl-6">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="shrink-0 tabular-nums text-foreground">{where}</span>
        {row.elapsedFromQueue ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 cursor-default tabular-nums">≤ {elapsed}</span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-64">
              {t(
                'resourceManager.heavyQueue.directElapsed',
                'Started through flock directly, so this counts from when it asked for the slot.'
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="shrink-0 tabular-nums">{elapsed}</span>
        )}
        <span className="min-w-0 flex-1 truncate" title={job.cwd}>
          {row.place}
        </span>
        {job.direct && (
          <span className="shrink-0 text-muted-foreground/60">
            {t('resourceManager.heavyQueue.direct', 'flock')}
          </span>
        )}
        <CopyCommand command={job.command} />
        {hasMenu && <RowMenu row={row} pending={pending} run={run} onConfirm={setConfirm} />}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t('resourceManager.heavyQueue.collapseCommand', 'Show less of the command')
            : t('resourceManager.heavyQueue.expandCommand', 'Show the whole command')
        }
        className={cn(
          'mt-0.5 block w-full rounded-sm pl-[18px] text-left font-mono text-[10px] text-muted-foreground/80 hover:text-foreground',
          expanded ? 'whitespace-pre-wrap break-all' : 'truncate'
        )}
      >
        {job.command}
      </button>
      {confirm && (
        <div className="mt-1 flex items-center gap-1.5 pl-[18px]">
          <span className="mr-auto text-[11px] text-foreground">
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
    </div>
  )
}

function HeavyQueueSection({
  hostId,
  label,
  queue
}: {
  hostId: string
  label: string
  queue: HeavyCommandQueue
}): React.JSX.Element {
  const t = useTranslate()
  const view = useMemo(() => buildHeavyQueueView(queue), [queue])
  const { run, pending, error } = useHeavyQueueActions(hostId)
  const setSlots = (slots: number): void =>
    run({ action: 'slots', slots }, (message) =>
      t('resourceManager.heavyQueue.slotsFailed', "Couldn't change the slots. {{value0}}", {
        value0: message
      })
    )
  const rows = [...view.running, ...view.waiting]
  return (
    <ResourceHostSection
      hostId={hostId}
      collapsedHosts={collapsedHosts}
      title={t('resourceManager.heavyQueue.title', 'Heavy command queue · {{value0}}', {
        value0: label
      })}
      tooltip={t(
        'resourceManager.heavyQueue.tooltip',
        'Builds, tests and installs run through vps-heavy take turns for a few slots, so the machine is not overloaded.'
      )}
      expandLabel={t('resourceManager.heavyQueue.expand', 'Expand heavy command queue')}
      collapseLabel={t('resourceManager.heavyQueue.collapse', 'Collapse heavy command queue')}
      trailing={
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {t('resourceManager.heavyQueue.busy', '{{value0}}/{{value1}} busy', {
            value0: view.busy,
            value1: view.slots
          })}
          {view.extra > 0 &&
            t('resourceManager.heavyQueue.busyExtra', ' + {{count}} extra', { count: view.extra })}
        </span>
      }
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 pl-6 text-[11px] text-muted-foreground">
        <span className="mr-auto">
          {t('resourceManager.heavyQueue.slots', 'Runs up to {{count}} at once', {
            count: view.slots,
            defaultValue_one: 'Runs one at a time'
          })}
        </span>
        {view.controls && (
          <>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={pending || view.slots <= 1}
              onClick={() => setSlots(view.slots - 1)}
              aria-label={t('resourceManager.heavyQueue.fewerSlots', 'Allow one fewer')}
            >
              <Minus />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={pending || view.slots >= MAX_OFFERED_SLOTS}
              onClick={() => setSlots(view.slots + 1)}
              aria-label={t('resourceManager.heavyQueue.moreSlots', 'Allow one more')}
            >
              <Plus />
            </Button>
          </>
        )}
      </div>
      {rows.map((row) => (
        <QueueRow key={row.job.pid} row={row} hostLabel={label} pending={pending} run={run} />
      ))}
      {rows.length === 0 && (
        <div className="px-3 py-1.5 pl-6 text-[11px] text-muted-foreground/70">
          {t('resourceManager.heavyQueue.empty', 'Nothing running or waiting.')}
        </div>
      )}
      {error && (
        <p role="alert" className="px-3 py-1.5 pl-6 text-[11px] text-destructive">
          {error}
        </p>
      )}
    </ResourceHostSection>
  )
}

/** One section per host with a vps-heavy queue; hosts without one show nothing. */
export function HeavyQueueSections({
  hosts
}: {
  hosts: readonly ResourceHostSummary[]
}): React.JSX.Element {
  return (
    <>
      {hosts.map((host) =>
        host.machine?.heavyQueue ? (
          <HeavyQueueSection
            key={host.id}
            hostId={host.id}
            label={host.label}
            queue={host.machine.heavyQueue}
          />
        ) : null
      )}
    </>
  )
}
