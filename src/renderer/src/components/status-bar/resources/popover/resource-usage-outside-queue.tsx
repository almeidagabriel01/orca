import React from 'react'
import { AppWindow, Box, ChevronDown, ChevronRight, SquareTerminal } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { OutsideQueueProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import { MetricPair } from './resource-usage-metrics'
import { useHostSectionCollapsed } from './resource-host-section'

const COLLAPSED_STORAGE_KEY = 'orca.resourceManager.outsideQueueCollapsed'

const KIND_ICON = { app: AppWindow, container: Box, command: SquareTerminal } as const

/** Heavy process groups the host's queue did not start; rendered as given, nothing hidden behind hover. */
export function HostOutsideQueue({
  hostId,
  label,
  groups,
  hasQueue
}: {
  hostId: string
  label: string
  groups: readonly OutsideQueueProcessGroup[]
  hasQueue: boolean
}): React.JSX.Element | null {
  const t = useTranslate()
  const [collapsed, toggleCollapsed] = useHostSectionCollapsed(COLLAPSED_STORAGE_KEY, hostId)
  if (groups.length === 0) {
    return null
  }
  const title = hasQueue
    ? t('resourceManager.outsideQueue.title', 'Running outside the queue')
    : t('resourceManager.outsideQueue.titleNoQueue', 'Heavy processes')
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
        <span className="text-2xs tabular-nums">({groups.length})</span>
        {collapsed && (
          <span className="ml-auto">
            <MetricPair
              cpu={groups.reduce((sum, group) => sum + group.cpu, 0)}
              memory={groups.reduce((sum, group) => sum + group.memory, 0)}
              size="small"
              flagHeavy
            />
          </span>
        )}
      </button>
      {!collapsed && (
        <p className="px-3 pb-1 text-2xs text-muted-foreground">
          {t(
            'resourceManager.outsideQueue.caption',
            'Heavy processes the queue did not start. CPU is a share of one core.'
          )}
        </p>
      )}
      {!collapsed && (
        <ul>
          {groups.map((group) => {
            const Icon = KIND_ICON[group.kind]
            const where = group.workspace
              ? `${group.workspace.repoName} / ${group.workspace.worktreeName}`
              : group.folder
            return (
              <li
                key={`${group.kind}:${group.name}:${group.launcher ?? ''}:${where ?? ''}`}
                className="flex items-start justify-between gap-x-3 gap-y-0.5 px-3 py-1 @max-[24rem]/queue:flex-col"
              >
                <div className="flex min-w-0 flex-1 items-start gap-1.5 text-xs">
                  <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-foreground">
                      {group.name}
                      {group.count > 1 && (
                        <span className="tabular-nums text-muted-foreground"> ({group.count})</span>
                      )}
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
                  <MetricPair cpu={group.cpu} memory={group.memory} size="small" flagHeavy />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
