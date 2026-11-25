import React from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { HostMachineTotals } from '../../host-connections/runtime-host-resources'
import { formatUsedOfTotal } from './resource-host-meters'
import { useHostSectionCollapsed } from './resource-host-section'

export const HOST_CARD_COLLAPSED_STORAGE_KEY = 'orca.resourceManager.hostCardCollapsed'

export function HostCardChevron({
  collapsed,
  label,
  onToggle
}: {
  collapsed: boolean
  label: string
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={
        collapsed
          ? t('resourceManager.hosts.expandCard', 'Expand {{value0}}', { value0: label })
          : t('resourceManager.hosts.collapseCard', 'Collapse {{value0}}', { value0: label })
      }
      className="-ml-1 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {collapsed ? (
        <ChevronRight className="size-3" aria-hidden />
      ) : (
        <ChevronDown className="size-3" aria-hidden />
      )}
    </button>
  )
}

/** A folded card's or metrics block's one line: CPU, RAM and load stay readable without unfolding. */
export function HostCollapsedSummary({
  machine,
  terminals,
  className = 'px-3 pt-1 pb-2.5'
}: {
  machine: HostMachineTotals | null
  terminals?: number
  className?: string
}): React.JSX.Element | null {
  const t = useTranslate()
  if (!machine) {
    return null
  }
  const heavyOutside = machine.outsideOrca?.filter((group) => group.heavy).length
  const parts = [
    machine.cpuPercent === null
      ? null
      : `${t('auto.components.status.bar.ResourceUsageStatusSegment.298f4be7f2', 'CPU')} ${Math.round(machine.cpuPercent)}%`,
    machine.memory
      ? `${t('resourceManager.hosts.ram', 'RAM')} ${formatUsedOfTotal(machine.memory)}`
      : null,
    machine.loadAverage
      ? `${t('resourceManager.hosts.loadLabel', 'Load')} ${machine.loadAverage[0].toFixed(2)}`
      : null,
    terminals === undefined
      ? null
      : t('resourceManager.hosts.terminals', '{{count}} terminals', {
          count: terminals,
          defaultValue_one: '{{count}} terminal'
        }),
    heavyOutside
      ? t('resourceManager.hosts.outsideCount', '{{count}} heavy outside the queue', {
          count: heavyOutside
        })
      : null
  ].filter(Boolean)
  return (
    <p className={`${className} text-2xs tabular-nums text-muted-foreground`}>
      {parts.join(' · ')}
    </p>
  )
}

/** One control that folds or opens every section of the Resource Manager. */
export function ResourceFoldAllToolbar({
  onSetAll
}: {
  onSetAll: (collapsed: boolean) => void
}): React.JSX.Element {
  const t = useTranslate()
  const buttonCls =
    'inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <div className="flex justify-end gap-2 px-3 pt-1">
      <button type="button" className={buttonCls} onClick={() => onSetAll(false)}>
        <ChevronsUpDown className="size-3" aria-hidden />
        {t('resourceManager.tree.expandAll', 'Expand all')}
      </button>
      <button type="button" className={buttonCls} onClick={() => onSetAll(true)}>
        <ChevronsDownUp className="size-3" aria-hidden />
        {t('resourceManager.tree.collapseAll', 'Collapse all')}
      </button>
    </div>
  )
}

const METRICS_COLLAPSED_STORAGE_KEY = 'orca.resourceManager.hostMetricsCollapsed'

/** The card's meters and counts under their own fold; folded, one summary line stays. */
export function HostMetricsFold({
  hostId,
  machine,
  terminals,
  children
}: {
  hostId: string
  machine: HostMachineTotals | null
  terminals?: number
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const [collapsed, toggle] = useHostSectionCollapsed(METRICS_COLLAPSED_STORAGE_KEY, hostId)
  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1 pt-1.5 pl-1.5 pr-3 text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {collapsed ? (
          <ChevronRight className="size-3 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        )}
        <span className="text-2xs font-semibold uppercase tracking-wider">
          {t('resourceManager.hosts.metrics', 'Metrics')}
        </span>
      </button>
      {collapsed ? (
        <HostCollapsedSummary machine={machine} terminals={terminals} className="px-3 pb-2.5" />
      ) : (
        children
      )}
    </div>
  )
}
