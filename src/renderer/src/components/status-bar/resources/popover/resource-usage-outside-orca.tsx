import React, { useMemo, useState } from 'react'
import { AppWindow, Box, ChevronDown, ChevronRight, Cpu, SquareTerminal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { OutsideOrcaProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import type { SortOption } from './resource-usage-resource-tree'
import { MetricPair, ROW_TRAILING_GUTTER_CLS } from './resource-usage-metrics'
import type { ResourceHostSummary } from './resource-host-summary'

const DEFAULT_VISIBLE_GROUPS = 8

// Like the project sections' collapse state, kept while Orca runs, across popover opens.
const collapsedHosts = new Set<string>()

const KIND_ICON = {
  app: AppWindow,
  container: Box,
  command: SquareTerminal,
  kernel: Cpu
} as const

function sortGroups(
  groups: readonly OutsideOrcaProcessGroup[],
  sortOption: SortOption
): OutsideOrcaProcessGroup[] {
  return [...groups].sort((a, b) =>
    sortOption === 'name'
      ? a.name.localeCompare(b.name)
      : sortOption === 'cpu'
        ? b.cpu - a.cpu || b.memory - a.memory
        : b.memory - a.memory || b.cpu - a.cpu
  )
}

function OutsideOrcaSection({
  hostId,
  label,
  groups,
  sortOption
}: {
  hostId: string
  label: string
  groups: readonly OutsideOrcaProcessGroup[]
  sortOption: SortOption
}): React.JSX.Element {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(() => collapsedHosts.has(hostId))
  const toggleCollapsed = (): void => {
    if (!collapsedHosts.delete(hostId)) {
      collapsedHosts.add(hostId)
    }
    setCollapsed(collapsedHosts.has(hostId))
  }
  const sorted = useMemo(() => sortGroups(groups, sortOption), [groups, sortOption])
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE_GROUPS)
  const hidden = sorted.length - visible.length
  return (
    <div className="border-t border-border/50">
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="py-2 pl-2 pr-0.5 transition-colors hover:bg-muted/50"
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? t('resourceManager.outsideOrca.expand', 'Expand Outside Orca')
              : t('resourceManager.outsideOrca.collapse', 'Collapse Outside Orca')
          }
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 cursor-default truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('resourceManager.outsideOrca.title', 'Outside Orca · {{value0}}', {
                  value0: label
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-64">
              {t(
                'resourceManager.outsideOrca.tooltip',
                'Apps, containers and commands Orca did not start, grouped. CPU is a share of one core, so it can pass 100% on multi-core machines.'
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {!collapsed && (
        <div className="border-t border-border/30">
          {visible.map((group) => {
            const Icon = KIND_ICON[group.kind]
            const name =
              group.kind === 'kernel'
                ? t('resourceManager.outsideOrca.kernel', 'Kernel')
                : group.name
            return (
              <div
                key={`${group.kind}:${group.name}`}
                className="flex items-center justify-between gap-2 px-3 py-1.5 pl-6"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{name}</span>
                  {group.processCount > 1 && (
                    <span className="shrink-0 tabular-nums text-muted-foreground/60">
                      {t('resourceManager.outsideOrca.processCount', '×{{value0}}', {
                        value0: group.processCount
                      })}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <MetricPair cpu={group.cpu} memory={group.memory} size="small" />
                  <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
                </div>
              </div>
            )
          })}
          {sorted.length > DEFAULT_VISIBLE_GROUPS && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full px-3 py-1.5 pl-6 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-expanded={expanded}
            >
              {expanded
                ? t('resourceManager.outsideOrca.showLess', 'Show less')
                : t('resourceManager.outsideOrca.showMore', 'Show {{count}} more', {
                    count: hidden
                  })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** One section per host that reports what runs outside Orca; older hosts report nothing and show nothing. */
export function OutsideOrcaSections({
  hosts,
  sortOption
}: {
  hosts: readonly ResourceHostSummary[]
  sortOption: SortOption
}): React.JSX.Element {
  return (
    <>
      {hosts.map((host) =>
        host.machine?.outsideOrca?.length ? (
          <OutsideOrcaSection
            key={host.id}
            hostId={host.id}
            label={host.label}
            groups={host.machine.outsideOrca}
            sortOption={sortOption}
          />
        ) : null
      )}
    </>
  )
}
