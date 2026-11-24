import React, { type Dispatch, type SetStateAction } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { MemorySnapshot } from '../../../../../../shared/diagnostics/process-stats-types'
import type {
  UnifiedProjectGroup,
  UnifiedSessionRow
} from '../workspace-attribution/resource-usage-merge-types'
import type { SortOption } from './resource-usage-resource-tree'
import { ResourceTree } from './resource-usage-resource-tree'
import {
  AppSection,
  CPU_COLUMN_CLS,
  MEM_COLUMN_CLS,
  METRIC_COLUMNS_CLS,
  ROW_TRAILING_GUTTER_CLS
} from './resource-usage-metrics'
import type { getResourceMemoryMetricCopy } from './resource-memory-metric-copy'
import type { ResourceHostSummary } from './resource-host-summary'
import { OutsideOrcaSections } from './resource-usage-outside-orca'
import { SharedAgentProcessesRow } from './resource-usage-chat-row'

function TreeToolbarButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-xs" variant="muted-field-icon" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function renderResourceUsagePopoverBody(
  {
    setPopoverBodyNode,
    overview,
    workspaceFilter,
    setWorkspaceFilter,
    setAllCollapsed,
    unifiedRepos,
    resourceSnapshot,
    sortOption,
    setSortOption,
    memoryMetricCopy,
    collapsedRepos,
    toggleRepo,
    collapsedWorktrees,
    activeWorktreeId,
    toggleWorktree,
    navigateToWorktree,
    navigateToTab,
    openChat,
    sharedAgentUsage,
    deleteWorktree,
    handleKillSession,
    appCollapsed,
    setAppCollapsed,
    daemonUnreachable,
    hostSummaries
  }: {
    setPopoverBodyNode: (node: HTMLDivElement | null) => void
    /** Owner split and machine cards, scrolled with the list so the popover has one scroll. */
    overview: React.ReactNode
    workspaceFilter: string
    setWorkspaceFilter: (value: string) => void
    setAllCollapsed: (collapsed: boolean) => void
    unifiedRepos: UnifiedProjectGroup[]
    resourceSnapshot: MemorySnapshot | null
    sortOption: SortOption
    setSortOption: Dispatch<SetStateAction<SortOption>>
    memoryMetricCopy: ReturnType<typeof getResourceMemoryMetricCopy>
    collapsedRepos: Set<string>
    toggleRepo: (repoId: string) => void
    collapsedWorktrees: Set<string>
    activeWorktreeId: string | null
    toggleWorktree: (worktreeId: string) => void
    navigateToWorktree: (worktreeId: string) => void
    navigateToTab: (tabId: string, paneKey: string | null) => void
    openChat: (worktreeId: string, agentSessionId: string, runtimeHostId?: string) => void
    sharedAgentUsage: { cpu: number; memory: number } | null
    deleteWorktree: (worktreeId: string) => void
    handleKillSession: (session: UnifiedSessionRow) => void
    appCollapsed: boolean
    setAppCollapsed: Dispatch<SetStateAction<boolean>>
    daemonUnreachable: boolean
    hostSummaries: readonly ResourceHostSummary[]
  },
  t: Translate = translate
): React.JSX.Element {
  const listsNothing = unifiedRepos.length === 0 && sharedAgentUsage === null
  return (
    <div
      ref={setPopoverBodyNode}
      tabIndex={-1}
      className="flex min-h-8 flex-1 flex-col outline-none"
    >
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
        {overview}
        {(unifiedRepos.length > 0 || resourceSnapshot) && (
          // Why sticky: the sort header and filter stay reachable while the list scrolls under them.
          <div className="sticky top-0 z-10 border-y border-border/50 bg-floating-surface">
            {unifiedRepos.length > 0 && (
              <div className="flex items-center gap-1 px-3 pt-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={workspaceFilter}
                    onChange={(event) => setWorkspaceFilter(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && workspaceFilter !== '') {
                        event.stopPropagation()
                        setWorkspaceFilter('')
                      }
                    }}
                    placeholder={t(
                      'resourceManager.tree.filterPlaceholder',
                      'Filter projects, workspaces, terminals'
                    )}
                    aria-label={t('resourceManager.tree.filter', 'Filter workspaces')}
                    density="compact"
                    inset="leadingIcon"
                    className="h-6"
                  />
                </div>
                <TreeToolbarButton
                  label={t('resourceManager.tree.expandAll', 'Expand all')}
                  onClick={() => setAllCollapsed(false)}
                >
                  <ChevronsUpDown />
                </TreeToolbarButton>
                <TreeToolbarButton
                  label={t('resourceManager.tree.collapseAll', 'Collapse all')}
                  onClick={() => setAllCollapsed(true)}
                >
                  <ChevronsDownUp />
                </TreeToolbarButton>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-1 text-3xs uppercase tracking-wide">
              <button
                type="button"
                onClick={() => setSortOption('name')}
                className={cn(
                  'hover:text-foreground transition-colors',
                  sortOption === 'name'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground/80'
                )}
                aria-pressed={sortOption === 'name'}
              >
                {t('auto.components.status.bar.ResourceUsageStatusSegment.2aa2de6cb9', 'Name')}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn(METRIC_COLUMNS_CLS, 'text-3xs')}>
                  <button
                    type="button"
                    onClick={() => setSortOption('cpu')}
                    className={cn(
                      CPU_COLUMN_CLS,
                      'hover:text-foreground transition-colors',
                      sortOption === 'cpu'
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground/80'
                    )}
                    aria-pressed={sortOption === 'cpu'}
                  >
                    {t('auto.components.status.bar.ResourceUsageStatusSegment.298f4be7f2', 'CPU')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOption('memory')}
                    className={cn(
                      MEM_COLUMN_CLS,
                      'hover:text-foreground transition-colors',
                      sortOption === 'memory'
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground/80'
                    )}
                    aria-pressed={sortOption === 'memory'}
                  >
                    {memoryMetricCopy.columnLabel}
                  </button>
                </div>
                {/* Why: empty trailing gutter keeps CPU/Memory header cells aligned with rows that reserve this width for the kill-X. */}
                <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
              </div>
            </div>
          </div>
        )}

        {unifiedRepos.length > 0 && (
          <ResourceTree
            repos={unifiedRepos}
            filter={workspaceFilter}
            sortOption={sortOption}
            collapsedRepos={collapsedRepos}
            toggleRepo={toggleRepo}
            collapsedWorktrees={collapsedWorktrees}
            activeWorktreeId={activeWorktreeId}
            toggleWorktree={toggleWorktree}
            navigateToWorktree={navigateToWorktree}
            navigateToTab={navigateToTab}
            onDelete={deleteWorktree}
            onKillSession={handleKillSession}
            onOpenChat={openChat}
          />
        )}
        {sharedAgentUsage && <SharedAgentProcessesRow usage={sharedAgentUsage} />}

        {listsNothing && resourceSnapshot && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t(
              'auto.components.status.bar.ResourceUsageStatusSegment.27a74f91f0',
              'Nothing running right now'
            )}
          </div>
        )}

        {resourceSnapshot && (
          <AppSection
            app={resourceSnapshot.app}
            isCollapsed={appCollapsed}
            onToggle={() => setAppCollapsed((v) => !v)}
          />
        )}

        <OutsideOrcaSections hosts={hostSummaries} sortOption={sortOption} />

        {!resourceSnapshot && !daemonUnreachable && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t('auto.components.status.bar.ResourceUsageStatusSegment.888dad8c55', 'Loading…')}
          </div>
        )}
      </div>
    </div>
  )
}

export function renderResourceUsagePopoverFooter(
  {
    handleOpenWorkspaceCleanup,
    orphanCount,
    handleKillOrphans
  }: {
    handleOpenWorkspaceCleanup: () => void
    orphanCount: number
    handleKillOrphans: () => Promise<void>
  },
  t: Translate = translate
): React.JSX.Element {
  return (
    <div className="border-t border-border/50 px-3 py-2 shrink-0">
      <button
        type="button"
        onClick={handleOpenWorkspaceCleanup}
        className="relative inline-flex w-full items-center justify-center rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        <span className="min-w-0 truncate px-4 text-center">
          {t(
            'auto.components.status.bar.ResourceUsageStatusSegment.92924a14e3',
            'Clean up workspaces'
          )}
        </span>
        <ChevronRight className="absolute right-2.5 size-3.5 text-muted-foreground" aria-hidden />
      </button>
      {orphanCount > 0 ? (
        <button
          type="button"
          onClick={() => void handleKillOrphans()}
          className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
        >
          {t(
            'auto.components.status.bar.ResourceUsageStatusSegment.endOrphanTerminals',
            'End {{count}} orphan terminals',
            {
              count: orphanCount,
              defaultValue_one: 'End {{count}} orphan terminal'
            }
          )}
        </button>
      ) : null}
    </div>
  )
}
