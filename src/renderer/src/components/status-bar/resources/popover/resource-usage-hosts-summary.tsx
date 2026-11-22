import React from 'react'
import { Laptop, Server } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
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
      <ul className="flex flex-col gap-1">
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
