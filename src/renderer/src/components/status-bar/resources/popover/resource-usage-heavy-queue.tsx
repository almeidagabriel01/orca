import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyCommandQueue } from '../../../../../../shared/diagnostics/process-stats-types'
import { useHostSectionCollapsed } from './resource-host-section'
import {
  buildHeavyQueueView,
  heavyQueueMoveSteps,
  withHeavyQueueOrder
} from './resource-heavy-queue-view'
import { callHeavyQueueAction, useHeavyQueueActions } from './resource-heavy-queue-actions'
import { SortableQueueRows } from './resource-heavy-queue-sortable'
import { QueueAction, QueueRow, type RowMoveHosts } from './resource-heavy-queue-row'
import {
  executeHeavyJobMove,
  heavyMoveTargets,
  heavyJobBlockersText,
  type HeavyMoveHost
} from './resource-heavy-job-move'

const COLLAPSED_STORAGE_KEY = 'orca.resourceManager.heavyQueueCollapsed'
/** The Resource Manager offers up to this many slots; a host set higher by hand keeps its number. */
const MAX_OFFERED_SLOTS = 3
const NO_HOSTS: readonly HeavyMoveHost[] = []

/** A host's vps-heavy queue inside its card: the summary and slot controls stay visible when folded. */
export function HostHeavyQueue({
  hostId,
  label,
  queue,
  movableHosts = NO_HOSTS,
  outsideCount = 0
}: {
  hostId: string
  label: string
  queue: HeavyCommandQueue
  /** Every card whose queue can move jobs, this one included. */
  movableHosts?: readonly HeavyMoveHost[]
  outsideCount?: number
}): React.JSX.Element {
  const t = useTranslate()
  // Why: a reorder shows at once; it holds until the first sample after it lands, and drops on failure.
  const [override, setOverride] = useState<{
    pids: number[]
    settledOn: HeavyCommandQueue | null
  } | null>(null)
  const latestQueue = useRef(queue)
  useEffect(() => {
    latestQueue.current = queue
  }, [queue])
  const view = useMemo(
    () =>
      buildHeavyQueueView(
        override && (override.settledOn === null || override.settledOn === queue)
          ? withHeavyQueueOrder(queue, override.pids)
          : queue
      ),
    [queue, override]
  )
  const { run, runTask, pending, error } = useHeavyQueueActions(hostId)
  const reorder = (pid: number, toIndex: number): void => {
    const order = view.waiting.filter((row) => row.can.startNow).map((row) => row.job.pid)
    const from = order.indexOf(pid)
    if (pending || from === -1 || toIndex < 0 || toIndex >= order.length || toIndex === from) {
      return
    }
    const pids = order.filter((other) => other !== pid)
    pids.splice(toIndex, 0, pid)
    setOverride({ pids, settledOn: null })
    runTask(
      async () => {
        try {
          // The script moves by up/down/top/bottom only, so a drop is a short run of those.
          for (const to of heavyQueueMoveSteps(from, toIndex)) {
            await callHeavyQueueAction(hostId, { action: 'move', pid, to })
          }
        } catch (cause) {
          setOverride(null)
          throw cause
        }
        setOverride({ pids, settledOn: latestQueue.current })
      },
      (message) =>
        t('resourceManager.heavyQueue.moveFailed', "Couldn't move it. {{value0}}", {
          value0: message
        })
    )
  }
  const source = queue.canMoveHost ? { id: hostId, label, queue } : null
  const moveHosts: RowMoveHosts = {
    source,
    targets: source ? heavyMoveTargets(hostId, movableHosts) : [],
    onMoveHost: (pid) => (target, plan) =>
      runTask(
        async () => {
          const blockers = source ? await executeHeavyJobMove(source, target, pid, plan) : []
          if (blockers.length > 0) {
            throw new Error(heavyJobBlockersText(blockers, t))
          }
        },
        (message) =>
          t(
            'resourceManager.heavyQueue.moveHostFailed',
            "Couldn't move it to {{value0}}. {{value1}}",
            {
              value0: target.label,
              value1: message
            }
          )
      )
  }
  const [collapsed, toggleCollapsed] = useHostSectionCollapsed(COLLAPSED_STORAGE_KEY, hostId)
  const setSlots = (slots: number): void =>
    run({ action: 'slots', slots }, (message) =>
      t('resourceManager.heavyQueue.slotsFailed', "Couldn't change the slots. {{value0}}", {
        value0: message
      })
    )
  const rows = [...view.running, ...view.moved, ...view.waiting]
  const full = view.busy >= view.slots && view.waiting.length > 0
  const slotsLabel = t('resourceManager.heavyQueue.slots', 'Runs up to {{count}} at once', {
    count: view.slots,
    defaultValue_one: 'Runs one at a time'
  })
  return (
    <section
      className="@container/queue border-t border-border/60"
      aria-label={t('resourceManager.heavyQueue.title', 'Heavy command queue · {{value0}}', {
        value0: label
      })}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 py-1 pl-1.5 pr-2 [grid-template-areas:'toggle_summary_stepper'] @max-[24rem]/queue:grid-cols-[minmax(0,1fr)_auto] @max-[24rem]/queue:[grid-template-areas:'toggle_stepper'_'summary_summary']">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? t('resourceManager.heavyQueue.expand', 'Expand heavy command queue')
              : t('resourceManager.heavyQueue.collapse', 'Collapse heavy command queue')
          }
          className="flex min-w-0 items-center gap-1 justify-self-start rounded-sm py-0.5 pr-1 text-muted-foreground [grid-area:toggle] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <ChevronRight className="size-3 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="size-3 shrink-0" aria-hidden />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="whitespace-nowrap text-2xs font-semibold uppercase tracking-wider">
                {t('resourceManager.heavyQueue.heading', 'Heavy queue')}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-64">
              {t(
                'resourceManager.heavyQueue.tooltip',
                'Builds, tests and installs run through the heavy queue take turns for a few slots, so the machine is not overloaded.'
              )}
            </TooltipContent>
          </Tooltip>
        </button>
        <span className="min-w-0 text-2xs tabular-nums text-muted-foreground [grid-area:summary] @max-[24rem]/queue:pl-4">
          <span className={cn('font-medium', full ? 'text-foreground' : undefined)}>
            {t('resourceManager.heavyQueue.busy', '{{value0}}/{{value1}} busy', {
              value0: view.busy,
              value1: view.slots
            })}
          </span>
          {view.extra > 0 &&
            t('resourceManager.heavyQueue.busyExtra', ' + {{count}} extra', { count: view.extra })}
          {' · '}
          <span className={cn(view.waiting.length > 0 && 'font-medium text-foreground')}>
            {t('resourceManager.heavyQueue.waiting', '{{count}} waiting', {
              count: view.waiting.length
            })}
          </span>
        </span>
        <div
          className="flex shrink-0 items-center gap-0.5 [grid-area:stepper]"
          role="group"
          aria-label={slotsLabel}
        >
          {view.controls && (
            <QueueAction
              label={t('resourceManager.heavyQueue.fewerSlots', 'Allow one fewer')}
              icon={Minus}
              disabled={pending || view.slots <= 1}
              onClick={() => setSlots(view.slots - 1)}
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-4 cursor-default text-center text-2xs font-medium tabular-nums text-foreground">
                {view.slots}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {slotsLabel}
            </TooltipContent>
          </Tooltip>
          {view.controls && (
            <QueueAction
              label={t('resourceManager.heavyQueue.moreSlots', 'Allow one more')}
              icon={Plus}
              disabled={pending || view.slots >= MAX_OFFERED_SLOTS}
              onClick={() => setSlots(view.slots + 1)}
            />
          )}
        </div>
      </div>
      {!collapsed && rows.length > 0 && (
        <SortableQueueRows
          rows={rows}
          pending={pending}
          onReorder={reorder}
          renderRow={(row, drag) => (
            <QueueRow
              key={row.job.pid}
              hostId={hostId}
              row={row}
              hostLabel={label}
              pending={pending}
              run={run}
              moveHosts={moveHosts}
              drag={drag}
              onStep={
                drag
                  ? (delta) =>
                      reorder(
                        row.job.pid,
                        view.waiting
                          .filter((other) => other.can.startNow)
                          .findIndex((other) => other.job.pid === row.job.pid) + delta
                      )
                  : undefined
              }
            />
          )}
        />
      )}
      {!collapsed && rows.length === 0 && (
        <p className="px-3 pb-2 text-2xs text-muted-foreground">
          {outsideCount > 0
            ? t(
                'resourceManager.heavyQueue.emptyOutside',
                'Nothing queued. {{count}} heavy processes run outside the queue.',
                {
                  count: outsideCount,
                  defaultValue_one: 'Nothing queued. 1 heavy process runs outside the queue.'
                }
              )
            : t('resourceManager.heavyQueue.empty', 'Nothing running or waiting.')}
        </p>
      )}
      {error && (
        <p role="alert" className="px-3 pb-2 text-2xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
