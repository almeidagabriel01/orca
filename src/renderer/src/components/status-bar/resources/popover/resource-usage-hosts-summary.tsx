import React, { useMemo } from 'react'
import {
  AlertTriangle,
  Bot,
  Laptop,
  Play,
  Server,
  SquareTerminal,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import * as ProgressPrimitive from 'radix-ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { HostMachineTotals } from '../../host-connections/runtime-host-resources'
import { formatCpu, formatMemory } from './resource-usage-metrics'
import type { ResourceHostSummary } from './resource-host-summary'
import {
  formatUsedOfTotal,
  loadPercent,
  percentTone,
  usedPercent,
  type MeterTone
} from './resource-host-meters'
import { HostOutsideQueue } from './resource-usage-outside-queue'
import { useHostSectionCollapsed } from './resource-host-section'
import {
  HOST_CARD_COLLAPSED_STORAGE_KEY,
  HostCardChevron,
  HostMetricsFold,
  HostCollapsedSummary
} from './resource-host-card-fold'
import { HostHeavyQueue } from './resource-usage-heavy-queue'
import type { HeavyMoveHost } from './resource-heavy-job-move'
import { HostLabelByHostnameContext } from './resource-heavy-queue-host-note'

const TONE_TEXT_CLS: Record<MeterTone, string> = {
  normal: 'text-foreground',
  warning: 'text-status-warning-text',
  critical: 'text-destructive'
}

const TONE_BAR_CLS: Record<MeterTone, string> = {
  normal: 'bg-foreground/50',
  warning: 'bg-status-warning',
  critical: 'bg-destructive'
}

function Meter({
  label,
  value,
  percent,
  detail
}: {
  label: string
  value: string
  percent: number | null
  detail?: string
}): React.JSX.Element {
  const tone = percentTone(percent)
  const body = (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-2xs leading-4">
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className={cn('truncate font-medium tabular-nums', TONE_TEXT_CLS[tone])}>
          {value}
        </span>
      </div>
      <ProgressPrimitive.Root
        value={Math.min(100, percent ?? 0)}
        aria-label={detail ? `${label} ${value}, ${detail}` : `${label} ${value}`}
        className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10"
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full w-full transition-all motion-reduce:transition-none',
            TONE_BAR_CLS[tone]
          )}
          style={{ transform: `translateX(-${100 - Math.min(100, percent ?? 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
  if (!detail) {
    return body
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-64">
        {detail}
      </TooltipContent>
    </Tooltip>
  )
}

function MachineMeters({ machine }: { machine: HostMachineTotals }): React.JSX.Element {
  const t = useTranslate()
  const cores =
    machine.cpuCores === null
      ? undefined
      : t('resourceManager.hosts.cores', '{{count}} cores', {
          count: machine.cpuCores,
          defaultValue_one: '{{count}} core'
        })
  const load = machine.loadAverage
  return (
    // Why auto-fill: three meters a row at the popover's width, two when it is squeezed.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-2.5">
      <Meter
        label={t('auto.components.status.bar.ResourceUsageStatusSegment.298f4be7f2', 'CPU')}
        value={machine.cpuPercent === null ? '—' : `${Math.round(machine.cpuPercent)}%`}
        percent={machine.cpuPercent}
        detail={cores}
      />
      <Meter
        label={t('resourceManager.hosts.ram', 'RAM')}
        value={machine.memory ? formatUsedOfTotal(machine.memory) : '—'}
        percent={usedPercent(machine.memory)}
      />
      <Meter
        label={t('resourceManager.hosts.disk', 'Disk')}
        value={machine.disk ? formatUsedOfTotal(machine.disk) : '—'}
        percent={usedPercent(machine.disk)}
      />
      <Meter
        label={t('resourceManager.hosts.loadLabel', 'Load')}
        value={load ? load[0].toFixed(2) : '—'}
        percent={loadPercent(load, machine.cpuCores)}
        detail={
          load
            ? t('resourceManager.hosts.loadDetail', '1, 5 and 15 min: {{value0}}', {
                value0: load.map((n) => n.toFixed(2)).join(' · ')
              }) + (cores ? ` · ${cores}` : '')
            : undefined
        }
      />
      <Meter
        label={t('resourceManager.hosts.swapLabel', 'Swap')}
        value={
          machine.swap === null
            ? '—'
            : machine.swap.total === 0
              ? t('resourceManager.hosts.noSwap', 'No swap')
              : formatUsedOfTotal(machine.swap)
        }
        percent={usedPercent(machine.swap)}
      />
    </div>
  )
}

function CountChip({
  icon: Icon,
  count,
  label
}: {
  icon: LucideIcon
  count: number
  label: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'inline-flex h-5 cursor-default items-center gap-1 rounded-md border border-border/70 px-1.5 text-2xs tabular-nums',
            count > 0 ? 'text-foreground' : 'text-muted-foreground/70'
          )}
        >
          <Icon className="size-3 text-muted-foreground" aria-hidden />
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function HostCard({
  host,
  movableHosts
}: {
  host: ResourceHostSummary
  movableHosts: readonly HeavyMoveHost[]
}): React.JSX.Element {
  const t = useTranslate()
  const Icon = host.isLocal ? Laptop : Server
  const sampled = host.counts !== null
  const [collapsed, toggleCollapsed] = useHostSectionCollapsed(
    HOST_CARD_COLLAPSED_STORAGE_KEY,
    host.id
  )
  return (
    <li data-host-card className="overflow-hidden rounded-lg border border-border bg-card/40">
      {/* Why wrap: on a narrow card Orca's usage drops to its own line before the name is cut. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-2.5">
        <HostCardChevron collapsed={collapsed} label={host.label} onToggle={toggleCollapsed} />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 break-words text-xs font-semibold text-foreground">
          {host.label}
        </span>
        <span className="shrink-0 text-3xs uppercase tracking-wider text-muted-foreground">
          {host.isLocal
            ? t('resourceManager.hosts.localBadge', 'Local')
            : t('resourceManager.hosts.remoteBadge', 'Remote')}
        </span>
        {host.orca && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto shrink-0 cursor-default text-2xs tabular-nums text-muted-foreground">
                {t('auto.components.status.bar.ResourceUsageStatusSegment.288a4dd177', 'Orca')}{' '}
                <span className="text-foreground">{formatCpu(host.orca.cpu)}</span>
                {' · '}
                <span className="text-foreground">{formatMemory(host.orca.memory)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {t('resourceManager.hosts.orcaUsage', "Orca's own CPU and memory on this machine")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {collapsed && <HostCollapsedSummary machine={host.machine} />}
      {!collapsed && host.notice && (
        <p
          className={cn(
            'flex items-start gap-1.5 px-3 pt-1.5 text-2xs',
            sampled ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          <AlertTriangle className="mt-px size-3 shrink-0 text-status-warning" aria-hidden />
          <span>{host.notice}</span>
        </p>
      )}
      {!collapsed && (
        <HostMetricsFold hostId={host.id} machine={host.machine} terminals={host.counts?.terminals}>
          <div className="space-y-2.5 px-3 pt-2 pb-2.5">
            {host.machine && <MachineMeters machine={host.machine} />}
            {host.counts && (
              <div className="flex flex-wrap items-center gap-1.5">
                <CountChip
                  icon={SquareTerminal}
                  count={host.counts.terminals}
                  label={t('resourceManager.hosts.terminals', '{{count}} terminals', {
                    count: host.counts.terminals,
                    defaultValue_one: '{{count}} terminal'
                  })}
                />
                <CountChip
                  icon={Bot}
                  count={host.counts.agents}
                  label={t('resourceManager.hosts.agents', '{{count}} agents', {
                    count: host.counts.agents,
                    defaultValue_one: '{{count}} agent'
                  })}
                />
                <CountChip
                  icon={Play}
                  count={host.counts.commands}
                  label={t('resourceManager.hosts.commands', '{{count}} commands', {
                    count: host.counts.commands,
                    defaultValue_one: '{{count}} command'
                  })}
                />
              </div>
            )}
          </div>
        </HostMetricsFold>
      )}
      {!collapsed && host.machine?.heavyQueue && (
        <HostHeavyQueue
          hostId={host.id}
          label={host.label}
          queue={host.machine.heavyQueue}
          movableHosts={movableHosts}
          outsideCount={host.machine.outsideQueue?.length}
        />
      )}
      {!collapsed && host.machine?.outsideQueue && (
        <HostOutsideQueue
          hostId={host.id}
          label={host.label}
          groups={host.machine.outsideQueue}
          hasQueue={Boolean(host.machine.heavyQueue)}
        />
      )}
    </li>
  )
}

/** One card per machine: its state, meters and counts, and its heavy queue when it has one. */
export function ResourceHostCards({
  hosts
}: {
  hosts: readonly ResourceHostSummary[]
}): React.JSX.Element {
  const t = useTranslate()
  const movableHosts = hosts.flatMap((host) =>
    host.machine?.heavyQueue?.canMoveHost
      ? [{ id: host.id, label: host.label, queue: host.machine.heavyQueue }]
      : []
  )
  const labelByHostname = useMemo(
    () =>
      new Map(
        // Reversed so the first card wins when one machine is paired twice.
        hosts.toReversed().flatMap((host) => {
          const hostname = host.machine?.heavyQueue?.hostname
          return hostname ? [[hostname, host.label] as const] : []
        })
      ),
    [hosts]
  )
  return (
    <HostLabelByHostnameContext.Provider value={labelByHostname}>
      <ul
        className="flex flex-col gap-2 px-3 pt-1 pb-3"
        aria-label={t('resourceManager.hosts.machines', 'Machines')}
      >
        {hosts.map((host) => (
          <HostCard key={host.id} host={host} movableHosts={movableHosts} />
        ))}
      </ul>
    </HostLabelByHostnameContext.Provider>
  )
}
