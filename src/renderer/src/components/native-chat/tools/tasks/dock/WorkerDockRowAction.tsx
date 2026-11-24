import { useTranslate } from '@/i18n/use-translate'
import { workerDockStateLabel } from './worker-dock-labels'
import { useRef, useState } from 'react'
import { Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import type { WorkerDockRowActionKind, WorkerDockRowView } from './WorkerDockRow'

/** A dock row's Stop, Clear or Dismiss, which keeps the pressed intent through a structural update. */
export function WorkerDockRowAction({
  row,
  narrow,
  pending,
  onAction
}: {
  row: WorkerDockRowView
  narrow: boolean
  pending: boolean
  onAction: (row: WorkerDockRowView, action: WorkerDockRowActionKind) => void
}) {
  const t = useTranslate()
  const gesture = useRef<{
    row: WorkerDockRowView
    action: WorkerDockRowActionKind
    rect: DOMRect | null
    cancelled: boolean
    activated: boolean
  } | null>(null)
  const [focusedAction, setFocusedAction] = useState<WorkerDockRowActionKind | null>(null)
  const failed = row.state === 'failed' || row.state === 'unexpected'
  const owner = row.ownerActionsAvailable !== false && !row.retired
  // Only an action that can run gets a button: a remote worker, a cleared row or a failure with
  // nothing to acknowledge shows none rather than a live-looking control that does nothing.
  const canClear = owner && failed && Boolean(row.settlement)
  const canStop = owner && !failed && row.stoppable && row.state !== 'saving'
  // Hiding ended work needs no owner: it only changes what this window shows.
  const canDismiss = !canClear && Boolean(row.dismissKey)
  const action = focusedAction ?? (canClear ? 'clear' : canDismiss ? 'dismiss' : 'stop')
  const unavailable = !canStop || pending
  return (
    <div
      className={cn(
        'flex shrink-0 justify-center pt-1.5',
        narrow ? 'w-11' : 'w-10',
        action === 'stop' &&
          !pending &&
          'opacity-0 group-hover/worker:opacity-100 group-focus-within/worker:opacity-100 [@media(pointer:coarse)]:opacity-100'
      )}
    >
      {canClear || canDismiss || canStop ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost-inset"
              size="icon-xs"
              data-worker-dock-action={row.id}
              className={cn(narrow ? (action === 'stop' ? 'size-11' : 'h-6 w-11') : 'size-6.5')}
              aria-label={
                action === 'clear'
                  ? t('components.native-chat.workerDock.clearName', 'Clear {{name}}', {
                      name: row.name
                    })
                  : action === 'dismiss'
                    ? t('components.native-chat.workerDock.dismissName', 'Dismiss {{name}}', {
                        name: row.name
                      })
                    : pending
                      ? t(
                          'components.native-chat.workerDock.stopUnavailable',
                          'Stop {{name}} · {{title}} unavailable · {{reason}}',
                          {
                            name: row.name,
                            title: row.title,
                            reason: workerDockStateLabel(t, 'stopping')
                          }
                        )
                      : t(
                          'components.native-chat.workerDock.stopName',
                          'Stop {{name}} · {{title}}',
                          {
                            name: row.name,
                            title: row.title
                          }
                        )
              }
              aria-disabled={action === 'stop' ? unavailable : pending}
              onPointerDown={(event) => {
                if (event.button === 0) {
                  window.addEventListener(
                    'pointerup',
                    () =>
                      setTimeout(() => {
                        gesture.current = null
                      }, 0),
                    { once: true }
                  )
                  gesture.current = {
                    row,
                    action,
                    rect: event.currentTarget.getBoundingClientRect(),
                    cancelled: false,
                    activated: false
                  }
                }
              }}
              onPointerLeave={() => {
                if (gesture.current?.rect) {
                  gesture.current.cancelled = true
                }
              }}
              onPointerMove={(event) => {
                const current = gesture.current
                const rect = current?.rect
                if (
                  current &&
                  rect &&
                  event.buttons &&
                  (event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom)
                ) {
                  current.cancelled = true
                }
              }}
              onPointerCancel={() => {
                if (gesture.current) {
                  gesture.current.cancelled = true
                }
              }}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
                  gesture.current = {
                    row,
                    action,
                    rect: null,
                    cancelled: false,
                    activated: false
                  }
                }
              }}
              onKeyUp={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  setTimeout(() => {
                    gesture.current = null
                  }, 0)
                }
              }}
              onBlur={() => {
                gesture.current = null
                setFocusedAction(null)
              }}
              onFocus={() => setFocusedAction(action)}
              onClick={() => {
                const captured = gesture.current
                if (captured?.cancelled || captured?.activated) {
                  return
                }
                const intendedRow = captured?.row ?? row
                const intendedAction = captured?.action ?? action
                if (
                  intendedAction === 'clear'
                    ? canClear && !pending
                    : intendedAction === 'dismiss'
                      ? canDismiss
                      : !unavailable
                ) {
                  if (captured) {
                    captured.activated = true
                  }
                  onAction(intendedRow, intendedAction)
                }
              }}
            >
              {action !== 'stop' ? (
                <X className="size-4" />
              ) : (
                <Square className="size-4 p-1" fill="currentColor" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {pending
              ? t('components.native-chat.workerDock.stopping', 'Stopping…')
              : action === 'clear'
                ? t('components.native-chat.workerDock.clear', 'Clear')
                : action === 'dismiss'
                  ? t('components.native-chat.workerDock.dismiss', 'Dismiss')
                  : t('components.native-chat.workerDock.stop', 'Stop')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
