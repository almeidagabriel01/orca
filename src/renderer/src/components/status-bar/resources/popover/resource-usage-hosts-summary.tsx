import React from 'react'
import { Laptop, Server } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { Progress } from '@/components/ui/progress'
import type { HostMachineTotals, UsedOfTotal } from '../../host-connections/runtime-host-resources'
import {
  CPU_COLUMN_CLS,
  MEM_COLUMN_CLS,
  METRIC_COLUMNS_CLS,
  ROW_TRAILING_GUTTER_CLS,
  formatCpu,
  formatMemory
} from './resource-usage-metrics'
import type { ResourceHostCounts, ResourceHostSummary } from './resource-host-summary'

function formatHostCounts(counts: ResourceHostCounts, t: Translate): string {
  return [
    t('resourceManager.hosts.terminals', '{{count}} terminals', {
      count: counts.terminals,
      defaultValue_one: '{{count}} terminal'
    }),
    t('resourceManager.hosts.agents', '{{count}} agents', {
      count: counts.agents,
      defaultValue_one: '{{count}} agent'
    }),
    t('resourceManager.hosts.commands', '{{count}} commands', {
      count: counts.commands,
      defaultValue_one: '{{count}} command'
    })
  ].join(' · ')
}

const GIB = 1024 ** 3

function formatUsedOfTotal({ used, total }: UsedOfTotal): string {
  const [unit, label] =
    total >= 1024 * GIB ? [1024 * GIB, 'TB'] : total >= GIB ? [GIB, 'GB'] : [1024 ** 2, 'MB']
  const digits = total / unit >= 100 ? 0 : 1
  return `${(used / unit).toFixed(digits)}/${(total / unit).toFixed(digits)} ${label}`
}

function usedPercent(pair: UsedOfTotal | null): number | null {
  return pair && pair.total > 0 ? (pair.used / pair.total) * 100 : null
}

function MachineMeter({
  label,
  value,
  percent
}: {
  label: string
  value: string
  percent: number | null
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="shrink-0">{label}</span>
        <span className="truncate text-foreground">{value}</span>
      </div>
      <Progress value={percent ?? 0} aria-label={`${label} ${value}`} className="h-1" />
    </div>
  )
}

function renderMachineTotals(machine: HostMachineTotals, t: Translate): React.JSX.Element {
  const swap =
    machine.swap === null
      ? '—'
      : machine.swap.total === 0
        ? t('resourceManager.hosts.noSwap', 'none')
        : formatUsedOfTotal(machine.swap)
  const details = [
    t('resourceManager.hosts.machine', 'Machine'),
    ...(machine.cpuCores === null
      ? []
      : [
          t('resourceManager.hosts.cores', '{{count}} cores', {
            count: machine.cpuCores,
            defaultValue_one: '{{count}} core'
          })
        ]),
    t('resourceManager.hosts.load', 'Load {{value0}}', {
      value0: machine.loadAverage?.map((n) => n.toFixed(2)).join(' ') ?? '—'
    }),
    t('resourceManager.hosts.swap', 'Swap {{value0}}', { value0: swap })
  ].join(' · ')
  return (
    <div className="pl-[18px] pt-0.5 text-2xs text-muted-foreground">
      <div className="truncate">{details}</div>
      <div className="grid grid-cols-3 gap-x-3 pt-0.5">
        <MachineMeter
          label={t('auto.components.status.bar.ResourceUsageStatusSegment.298f4be7f2', 'CPU')}
          value={machine.cpuPercent === null ? '—' : `${Math.round(machine.cpuPercent)}%`}
          percent={machine.cpuPercent}
        />
        <MachineMeter
          label={t('resourceManager.hosts.ram', 'RAM')}
          value={machine.memory ? formatUsedOfTotal(machine.memory) : '—'}
          percent={usedPercent(machine.memory)}
        />
        <MachineMeter
          label={t('resourceManager.hosts.disk', 'Disk')}
          value={machine.disk ? formatUsedOfTotal(machine.disk) : '—'}
          percent={usedPercent(machine.disk)}
        />
      </div>
    </div>
  )
}

export function renderResourceHostsSummary(
  hosts: readonly ResourceHostSummary[],
  t: Translate = translate
): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-border px-3 py-1.5 text-xs tabular-nums">
      <div className="flex items-center justify-between pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
        <span>{t('resourceManager.hosts.title', 'Hosts · Orca usage')}</span>
        <div className="flex shrink-0 items-center gap-2">
          <div className={cn(METRIC_COLUMNS_CLS, 'text-[10px]')}>
            <span className={CPU_COLUMN_CLS}>
              {t('auto.components.status.bar.ResourceUsageStatusSegment.298f4be7f2', 'CPU')}
            </span>
            <span className={MEM_COLUMN_CLS}>{t('resourceManager.hosts.memory', 'Memory')}</span>
          </div>
          <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {hosts.map((host) => {
          const Icon = host.isLocal ? Laptop : Server
          return (
            <li key={host.id} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium text-foreground">{host.label}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <div className={METRIC_COLUMNS_CLS}>
                    <span className={CPU_COLUMN_CLS}>
                      {host.orca ? formatCpu(host.orca.cpu) : '—'}
                    </span>
                    <span className={MEM_COLUMN_CLS}>
                      {host.orca ? formatMemory(host.orca.memory) : '—'}
                    </span>
                  </div>
                  <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
                </div>
              </div>
              <div className="truncate pl-[18px] text-2xs text-muted-foreground">
                {host.counts ? formatHostCounts(host.counts, t) : host.notice}
              </div>
              {host.machine ? renderMachineTotals(host.machine, t) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
