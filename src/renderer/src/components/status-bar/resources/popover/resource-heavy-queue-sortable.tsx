import React, { useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Modifier
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyQueueRow } from './resource-heavy-queue-view'
import type { QueueRowDrag } from './resource-heavy-queue-row'

const pointerOptions = { activationConstraint: { distance: 4 } }
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })
const MODIFIERS = [verticalOnly]

/** Rows in run order; only ordered waiters drag, and they drop only among themselves. */
export function SortableQueueRows({
  rows,
  pending,
  onReorder,
  renderRow
}: {
  rows: readonly HeavyQueueRow[]
  pending: boolean
  /** Index among the ordered waiters, not the row's #position (flock waiters count there). */
  onReorder: (pid: number, toIndex: number) => void
  renderRow: (row: HeavyQueueRow, drag?: QueueRowDrag) => ReactNode
}): React.JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, pointerOptions))
  const t = useTranslate()
  const hint = t(
    'resourceManager.heavyQueue.reorderHint',
    'Drag to reorder, or press Alt+Up / Alt+Down'
  )
  const accessibility = useMemo(() => ({ screenReaderInstructions: { draggable: hint } }), [hint])
  const orderable = rows.filter((row) => row.can.startNow).map((row) => row.job.pid)
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const fromIndex = drag ? orderable.indexOf(drag.from) : -1
  const overIndex = drag ? orderable.indexOf(drag.over) : -1
  const sortable = orderable.length > 1
  return (
    <DndContext
      sensors={sensors}
      accessibility={accessibility}
      collisionDetection={closestCenter}
      modifiers={MODIFIERS}
      onDragStart={({ active }) => setDrag({ from: Number(active.id), over: Number(active.id) })}
      onDragOver={({ active, over }) =>
        setDrag(over ? { from: Number(active.id), over: Number(over.id) } : null)
      }
      onDragCancel={() => setDrag(null)}
      onDragEnd={({ active, over }) => {
        setDrag(null)
        const to = over ? orderable.indexOf(Number(over.id)) : -1
        if (to !== -1 && active.id !== over?.id) {
          onReorder(Number(active.id), to)
        }
      }}
    >
      <SortableContext items={orderable} strategy={verticalListSortingStrategy}>
        <ul className="pb-1">
          {rows.map((row) =>
            sortable && row.can.startNow ? (
              <SortableQueueRow
                key={row.job.pid}
                row={row}
                pending={pending}
                insertion={
                  row.job.pid === drag?.over && fromIndex !== overIndex
                    ? fromIndex < overIndex
                      ? 'after'
                      : 'before'
                    : undefined
                }
                renderRow={renderRow}
              />
            ) : (
              <React.Fragment key={row.job.pid}>{renderRow(row)}</React.Fragment>
            )
          )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableQueueRow({
  row,
  pending,
  insertion,
  renderRow
}: {
  row: HeavyQueueRow
  pending: boolean
  insertion: QueueRowDrag['insertion']
  renderRow: (row: HeavyQueueRow, drag?: QueueRowDrag) => ReactNode
}): ReactNode {
  const t = useTranslate()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: row.job.pid, disabled: pending })
  const label = t(
    'resourceManager.heavyQueue.reorderHint',
    'Drag to reorder, or press Alt+Up / Alt+Down'
  )
  return renderRow(row, {
    rowRef: setNodeRef,
    rowStyle: {
      transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
      transition,
      zIndex: isDragging ? 1 : undefined
    },
    dragging: isDragging,
    insertion,
    grip: (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={label}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            aria-disabled={pending}
            data-queue-grip
            className="-m-0.5 flex shrink-0 cursor-grab touch-none items-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing aria-disabled:cursor-default"
          >
            <GripVertical className="size-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  })
}
