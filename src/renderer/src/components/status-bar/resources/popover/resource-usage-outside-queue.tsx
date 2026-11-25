import React, { useState } from 'react'
import { AppWindow, Box, ChevronDown, ChevronRight, Cpu, SquareTerminal } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { OutsideOrcaProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import { MetricPair } from './resource-usage-metrics'
import { useHostSectionCollapsed } from './resource-host-section'

const COLLAPSED_STORAGE_KEY = 'orca.resourceManager.outsideQueueCollapsed'

const KIND_ICON = { app: AppWindow, container: Box, command: SquareTerminal, kernel: Cpu } as const

function OutsideRow({
  group,
  heavy
}: {
  group: OutsideOrcaProcessGroup
  heavy: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const Icon = KIND_ICON[group.kind]
  const name =
    group.kind === 'kernel' ? t('resourceManager.outsideOrca.kernel', 'Kernel') : group.name
  const count = group.devices ?? group.processCount
  const where = group.workspace
    ? `${group.workspace.repoName} / ${group.workspace.worktreeName}`
    : group.folder
  return (
    <li className="flex items-start justify-between gap-x-3 gap-y-0.5 px-3 py-1 @max-[24rem]/queue:flex-col">
      <div className="flex min-w-0 flex-1 items-start gap-1.5 text-xs">
        <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 break-words">
          <span className={heavy ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {name}
            {count > 1 && <span className="tabular-nums text-muted-foreground"> ({count})</span>}
          </span>
          {(group.launcher || where) && (
            <div className="text-2xs text-muted-foreground">
              {[
                group.launcher &&
                  t('resourceManager.outsideQueue.via', 'via {{value0}}', {
                    value0: group.launcher
                  }),
                where
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
      </div>
      <div className="@max-[24rem]/queue:pl-[1.125rem]">
        <MetricPair cpu={group.cpu} memory={group.memory} size="small" flagHeavy={heavy} />
      </div>
    </li>
  )
}

/** Everything the host's queue did not start, once: heavy groups first and always shown, the rest folded. */
export function HostOutsideQueue({
  hostId,
  label,
  heavy,
  rest,
  hasQueue
}: {
  hostId: string
  label: string
  heavy: readonly OutsideOrcaProcessGroup[]
  rest: readonly OutsideOrcaProcessGroup[]
  hasQueue: boolean
}): React.JSX.Element | null {
  const t = useTranslate()
  const [collapsed, toggleCollapsed] = useHostSectionCollapsed(COLLAPSED_STORAGE_KEY, hostId)
  const [showRest, setShowRest] = useState(false)
  if (heavy.length === 0 && rest.length === 0) {
    return null
  }
  const all = [...heavy, ...rest]
  const title = hasQueue
    ? t('resourceManager.outsideQueue.title', 'Outside the queue')
    : t('resourceManager.outsideQueue.titleNoQueue', 'Outside Orca')
  const lighter = [...rest].sort((a, b) => b.cpu - a.cpu || b.memory - a.memory)
  return (
    <section
      className={`@container/queue ${hasQueue ? 'border-t border-border/60 ' : ''}pb-1.5`}
      aria-label={`${title} · ${label}`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="flex w-full flex-wrap items-center gap-x-1 py-1 pl-1.5 pr-3 text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {collapsed ? (
          <ChevronRight className="size-3 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        )}
        <span className="whitespace-nowrap text-2xs font-semibold uppercase tracking-wider">
          {title}
        </span>
        <span className="text-2xs tabular-nums">({all.length})</span>
        <span className="ml-auto">
          <MetricPair
            cpu={all.reduce((sum, group) => sum + group.cpu, 0)}
            memory={all.reduce((sum, group) => sum + group.memory, 0)}
            size="small"
          />
        </span>
      </button>
      {!collapsed && (
        <p className="px-3 pb-1 text-2xs text-muted-foreground">
          {t(
            'resourceManager.outsideQueue.caption',
            'Processes the queue did not start, heavy ones first. CPU is a share of one core.'
          )}
        </p>
      )}
      {!collapsed && (
        <ul>
          {heavy.map((group) => (
            <OutsideRow key={rowKey(group)} group={group} heavy />
          ))}
          {showRest &&
            lighter.map((group) => <OutsideRow key={rowKey(group)} group={group} heavy={false} />)}
        </ul>
      )}
      {!collapsed && lighter.length > 0 && (
        <button
          type="button"
          onClick={() => setShowRest((v) => !v)}
          className="w-full px-3 py-1 pl-[1.875rem] text-left text-2xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-expanded={showRest}
        >
          {showRest
            ? t('resourceManager.outsideOrca.showLess', 'Show less')
            : t('resourceManager.outsideOrca.showMore', 'Show {{count}} more', {
                count: lighter.length
              })}
        </button>
      )}
    </section>
  )
}

function rowKey(group: OutsideOrcaProcessGroup): string {
  return `${group.kind}:${group.name}:${group.launcher ?? ''}:${group.workspace?.worktreeName ?? group.folder ?? ''}`
}
