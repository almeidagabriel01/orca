import React from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  FolderOpen,
  MoreHorizontal,
  Square,
  X,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host/execution-host'
import type { HeavyQueueRow } from './resource-heavy-queue-view'
import { QueueMenuItem } from './resource-heavy-queue-row-menu-item'
import type { HeavyMoveHost } from './resource-heavy-job-move'
import { RunOnHostItems, type HeavyJobMoveRequest } from './resource-heavy-queue-move-items'

export type QueueMove = 'up' | 'down' | 'top' | 'bottom'
export type ConfirmKind = 'start' | 'remove' | 'stop'

/** Every row's full action list, also the only way in on a narrow card. Off actions say why. */
export function QueueRowMenu({
  hostId,
  row,
  pending,
  onMove,
  onRunNext,
  onConfirm,
  moveSource,
  moveTargets,
  onMoveHost
}: {
  hostId: string
  row: HeavyQueueRow
  pending: boolean
  onMove: (to: QueueMove) => void
  onRunNext: () => void
  onConfirm: (kind: ConfirmKind) => void
  /** This host when its queue can move jobs, with the other hosts that can take them. */
  moveSource: HeavyMoveHost | null
  moveTargets: readonly HeavyMoveHost[]
  onMoveHost: HeavyJobMoveRequest
}): React.JSX.Element {
  const t = useTranslate()
  const { job, can } = row
  const waiting = job.status === 'waiting'
  const readOnly = t(
    'resourceManager.heavyQueue.reasonReadOnly',
    "This host's queue can't be changed from here"
  )
  const outsideOrder = t(
    'resourceManager.heavyQueue.reasonOutsideOrder',
    'Started through flock, outside the queue order'
  )
  // Why one reason per row: a read-only host or a flock job blocks every move the same way.
  const orderReason = !can.remove ? readOnly : !can.startNow ? outsideOrder : null
  const moveReason = (allowed: boolean, edge: string): string | null =>
    orderReason ?? (allowed ? null : edge)
  const first = t('resourceManager.heavyQueue.reasonFirst', 'Already first in line')
  const last = t('resourceManager.heavyQueue.reasonLast', 'Already last in line')
  const label = t('resourceManager.heavyQueue.actions', 'Queue actions')
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="muted-field-icon"
              disabled={pending}
              aria-label={label}
              data-queue-menu
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        {waiting && (
          <>
            {orderReason && (
              <div className="px-2 py-1.5 text-2xs text-muted-foreground">{orderReason}</div>
            )}
            <QueueMenuItem
              icon={ArrowUp}
              label={t('resourceManager.heavyQueue.moveUp', 'Move up')}
              quiet={orderReason !== null}
              reason={moveReason(can.moveUp, first)}
              onSelect={() => onMove('up')}
            />
            <QueueMenuItem
              icon={ArrowDown}
              label={t('resourceManager.heavyQueue.moveDown', 'Move down')}
              quiet={orderReason !== null}
              reason={moveReason(can.moveDown, last)}
              onSelect={() => onMove('down')}
            />
            <QueueMenuItem
              icon={ArrowUpToLine}
              label={t('resourceManager.heavyQueue.runNext', 'Run next')}
              quiet={orderReason !== null}
              reason={moveReason(can.runNext, first)}
              onSelect={onRunNext}
            />
            <QueueMenuItem
              icon={ArrowDownToLine}
              label={t('resourceManager.heavyQueue.moveToEnd', 'Move to end')}
              quiet={orderReason !== null}
              reason={moveReason(can.moveToEnd, last)}
              onSelect={() => onMove('bottom')}
            />
            <QueueMenuItem
              icon={Zap}
              label={t('resourceManager.heavyQueue.startNow', 'Start now…')}
              quiet
              reason={orderReason}
              onSelect={() => onConfirm('start')}
            />
            <DropdownMenuSeparator />
          </>
        )}
        {moveSource && moveTargets.length > 0 && job.status !== 'moved' && (
          <>
            <RunOnHostItems
              source={moveSource}
              targets={moveTargets}
              job={job}
              onMove={onMoveHost}
            />
            <DropdownMenuSeparator />
          </>
        )}
        <QueueMenuItem
          icon={Copy}
          label={t('resourceManager.sessionProcesses.copy', 'Copy command')}
          reason={null}
          onSelect={() => void window.api.ui.writeClipboardText(job.command)}
        />
        <QueueMenuItem
          icon={FolderOpen}
          label={t('resourceManager.heavyQueue.openFolder', 'Open folder')}
          reason={
            hostId === 'local'
              ? null
              : t(
                  'resourceManager.heavyQueue.reasonRemoteFolder',
                  'The folder is on another machine'
                )
          }
          onSelect={() => void window.api.shell.openPath(job.cwd, LOCAL_EXECUTION_HOST_ID)}
        />
        <DropdownMenuSeparator />
        {!waiting ? (
          <QueueMenuItem
            icon={Square}
            label={t('resourceManager.heavyQueue.stop', 'Stop…')}
            reason={
              can.stop
                ? null
                : t(
                    'resourceManager.heavyQueue.reasonCantStop',
                    "This host's heavy queue can't stop commands; update it"
                  )
            }
            destructive
            onSelect={() => onConfirm('stop')}
          />
        ) : (
          <QueueMenuItem
            icon={X}
            label={t('resourceManager.heavyQueue.remove', 'Remove from queue…')}
            reason={can.remove ? null : readOnly}
            destructive
            onSelect={() => onConfirm('remove')}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
