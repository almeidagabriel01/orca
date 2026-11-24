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
import { useTranslate } from '@/i18n/use-translate'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host/execution-host'
import type { HeavyQueueRow } from './resource-heavy-queue-view'

export type QueueMove = 'up' | 'down' | 'top' | 'bottom'

function Item({
  icon: Icon,
  label,
  reason,
  destructive,
  onSelect
}: {
  icon: LucideIcon
  label: string
  /** Why it is off; null when offered. Shown under the label, not only on hover. */
  reason: string | null
  destructive?: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <DropdownMenuItem
      disabled={reason !== null}
      variant={destructive ? 'destructive' : 'default'}
      aria-label={reason ? `${label}. ${reason}` : undefined}
      onSelect={onSelect}
      className="items-start"
    >
      <Icon className="mt-0.5" />
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {reason && <span className="text-2xs text-muted-foreground">{reason}</span>}
      </span>
    </DropdownMenuItem>
  )
}

/** Every row's full action list, also the only way in on a narrow card. Off actions say why. */
export function QueueRowMenu({
  hostId,
  row,
  pending,
  onMove,
  onRunNext,
  onConfirm
}: {
  hostId: string
  row: HeavyQueueRow
  pending: boolean
  onMove: (to: QueueMove) => void
  onRunNext: () => void
  onConfirm: (kind: 'start' | 'remove') => void
}): React.JSX.Element {
  const t = useTranslate()
  const { job, can } = row
  const running = job.status === 'running'
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
              variant="ghost-inset"
              disabled={pending}
              aria-label={label}
              data-queue-menu
              className="text-muted-foreground hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
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
        {!running && (
          <>
            <Item
              icon={ArrowUp}
              label={t('resourceManager.heavyQueue.moveUp', 'Move up')}
              reason={moveReason(can.moveUp, first)}
              onSelect={() => onMove('up')}
            />
            <Item
              icon={ArrowDown}
              label={t('resourceManager.heavyQueue.moveDown', 'Move down')}
              reason={moveReason(can.moveDown, last)}
              onSelect={() => onMove('down')}
            />
            <Item
              icon={ArrowUpToLine}
              label={t('resourceManager.heavyQueue.runNext', 'Run next')}
              reason={moveReason(can.runNext, first)}
              onSelect={onRunNext}
            />
            <Item
              icon={ArrowDownToLine}
              label={t('resourceManager.heavyQueue.moveToEnd', 'Move to end')}
              reason={moveReason(can.moveToEnd, last)}
              onSelect={() => onMove('bottom')}
            />
            <Item
              icon={Zap}
              label={t('resourceManager.heavyQueue.startNow', 'Start now…')}
              reason={orderReason}
              onSelect={() => onConfirm('start')}
            />
            <DropdownMenuSeparator />
          </>
        )}
        <Item
          icon={Copy}
          label={t('resourceManager.sessionProcesses.copy', 'Copy command')}
          reason={null}
          onSelect={() => void window.api.ui.writeClipboardText(job.command)}
        />
        <Item
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
        {running ? (
          <Item
            icon={Square}
            label={t('resourceManager.heavyQueue.stop', 'Stop…')}
            reason={t(
              'resourceManager.heavyQueue.reasonCantStop',
              "vps-heavy can't stop a running command yet; stop it in its terminal"
            )}
            destructive
            onSelect={() => {}}
          />
        ) : (
          <Item
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
