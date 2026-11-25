import React, { useMemo, useState } from 'react'
import { AppWindow, Box, Cpu, SquareTerminal } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { OutsideOrcaProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import type { SortOption } from './resource-usage-resource-tree'
import { MetricPair, ROW_TRAILING_GUTTER_CLS } from './resource-usage-metrics'
import type { ResourceHostSummary } from './resource-host-summary'
import { ResourceHostSection } from './resource-host-section'

const DEFAULT_VISIBLE_GROUPS = 8

const COLLAPSED_STORAGE_KEY = 'orca.resourceManager.outsideOrcaCollapsed'

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
  const sorted = useMemo(() => sortGroups(groups, sortOption), [groups, sortOption])
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE_GROUPS)
  const hidden = sorted.length - visible.length
  return (
    <ResourceHostSection
      hostId={hostId}
      storageKey={COLLAPSED_STORAGE_KEY}
      title={t('resourceManager.outsideOrca.title', 'Outside Orca · {{value0}}', { value0: label })}
      tooltip={t(
        'resourceManager.outsideOrca.tooltip',
        'Apps, containers and commands Orca did not start, grouped. CPU is a share of one core, so it can pass 100% on multi-core machines.'
      )}
      expandLabel={t('resourceManager.outsideOrca.expand', 'Expand Outside Orca')}
      collapseLabel={t('resourceManager.outsideOrca.collapse', 'Collapse Outside Orca')}
      trailing={
        <span className="flex shrink-0 items-center gap-2">
          <MetricPair
            cpu={groups.reduce((sum, group) => sum + group.cpu, 0)}
            memory={groups.reduce((sum, group) => sum + group.memory, 0)}
            size="small"
          />
          <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
        </span>
      }
    >
      {visible.map((group) => {
        const Icon = KIND_ICON[group.kind]
        const name =
          group.kind === 'kernel' ? t('resourceManager.outsideOrca.kernel', 'Kernel') : group.name
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
              <MetricPair cpu={group.cpu} memory={group.memory} size="small" flagHeavy />
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
    </ResourceHostSection>
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
