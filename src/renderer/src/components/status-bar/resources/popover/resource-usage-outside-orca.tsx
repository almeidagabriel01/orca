import React, { useMemo, useState } from 'react'
import { AppWindow, Box, Cpu, SquareTerminal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import {
  OUTSIDE_HEAVY_CPU_PERCENT,
  OUTSIDE_HEAVY_MEMORY_BYTES,
  type OutsideOrcaProcessGroup
} from '../../../../../../shared/diagnostics/process-stats-types'
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

// Heavy groups lead whatever the sort, so "Show more" never hides one.
function sortGroups(
  groups: readonly OutsideOrcaProcessGroup[],
  sortOption: SortOption
): OutsideOrcaProcessGroup[] {
  return [...groups].sort(
    (a, b) =>
      Number(Boolean(b.heavy)) - Number(Boolean(a.heavy)) ||
      (sortOption === 'name'
        ? a.name.localeCompare(b.name)
        : sortOption === 'cpu'
          ? b.cpu - a.cpu || b.memory - a.memory
          : b.memory - a.memory || b.cpu - a.cpu)
  )
}

function OutsideOrcaRow({ group }: { group: OutsideOrcaProcessGroup }): React.JSX.Element {
  const t = useTranslate()
  const Icon = KIND_ICON[group.kind]
  const name =
    group.kind === 'kernel' ? t('resourceManager.outsideOrca.kernel', 'Kernel') : group.name
  const where = group.workspace
    ? `${group.workspace.repoName} / ${group.workspace.worktreeName}`
    : group.folder
  const meta = [
    group.launcher &&
      t('resourceManager.outsideOrca.via', 'via {{value0}}', { value0: group.launcher }),
    where
  ].filter(Boolean)
  const count = group.devices ?? group.processCount
  return (
    <div className="flex items-start justify-between gap-x-2 gap-y-0.5 px-3 py-1 pl-6 @max-[22rem]/outside:flex-col">
      <div className="min-w-0 flex-1 text-2xs">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span
            className={cn(
              'min-w-0 break-words',
              group.heavy ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {name}
          </span>
          {count > 1 && (
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {t('resourceManager.outsideOrca.processCount', '×{{value0}}', { value0: count })}
            </span>
          )}
          {group.heavy && (
            <Badge variant="rowWarning">{t('resourceManager.outsideOrca.heavy', 'heavy')}</Badge>
          )}
        </div>
        {meta.length > 0 && (
          <div className="break-words pl-[1.125rem] text-muted-foreground">{meta.join(' · ')}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 @max-[22rem]/outside:pl-[1.125rem]">
        {/* Why the host's marks on heavy rows: the badge and the coloured value then agree. */}
        <MetricPair
          cpu={group.cpu}
          memory={group.memory}
          size="small"
          flagHeavy={
            group.heavy
              ? {
                  cpu: group.cpu >= OUTSIDE_HEAVY_CPU_PERCENT,
                  memory: group.memory >= OUTSIDE_HEAVY_MEMORY_BYTES
                }
              : true
          }
        />
        <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
      </div>
    </div>
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
  const outside = useMemo(() => sortGroups(groups, sortOption), [groups, sortOption])
  const shown = Math.max(DEFAULT_VISIBLE_GROUPS, outside.filter((group) => group.heavy).length)
  const visible = expanded ? outside : outside.slice(0, shown)
  const rowKey = (group: OutsideOrcaProcessGroup): string =>
    `${group.kind}:${group.name}:${group.launcher ?? ''}`
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
            cpu={outside.reduce((sum, group) => sum + group.cpu, 0)}
            memory={outside.reduce((sum, group) => sum + group.memory, 0)}
            size="small"
          />
          <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
        </span>
      }
    >
      <div className="@container/outside">
        {visible.map((group) => (
          <OutsideOrcaRow key={rowKey(group)} group={group} />
        ))}
      </div>
      {outside.length > shown ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-3 py-1.5 pl-6 text-left text-2xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded
            ? t('resourceManager.outsideOrca.showLess', 'Show less')
            : t('resourceManager.outsideOrca.showMore', 'Show {{count}} more', {
                count: outside.length - visible.length
              })}
        </button>
      ) : null}
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
