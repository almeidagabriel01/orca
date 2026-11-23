import React, { useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { renderResourceUsageSummary } from './resource-usage-popover-summary'
import { ResourceHostCards } from './resource-usage-hosts-summary'
import {
  renderResourceUsagePopoverBody,
  renderResourceUsagePopoverFooter
} from './resource-usage-popover-body'
import type { SortOption } from './resource-usage-resource-tree'
import { getResourceMemoryMetricCopy } from './resource-memory-metric-copy'
import type { ResourceHostSummary } from './resource-host-summary'
import {
  localHost,
  offlineHost,
  popoverHosts,
  popoverOwnerSplit,
  popoverRepos
} from './resource-manager-popover.fixture-data'

const SURFACE =
  'flex flex-col overflow-hidden rounded-md border border-black/14 bg-floating-surface text-popover-foreground dark:border-white/14'

function Popover({
  height,
  hosts = popoverHosts
}: {
  height: number
  hosts?: ResourceHostSummary[]
}): React.JSX.Element {
  const [sortOption, setSortOption] = useState<SortOption>('memory')
  const [appCollapsed, setAppCollapsed] = useState(true)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className={SURFACE} style={{ height }}>
      {renderResourceUsagePopoverBody({
        setPopoverBodyNode: () => {},
        overview: (
          <>
            {renderResourceUsageSummary({
              ownerSplit: popoverOwnerSplit,
              commitBadgeLabel: null,
              commitToneClass: null,
              orphanCount: 0
            })}
            <ResourceHostCards hosts={hosts} />
          </>
        ),
        workspaceFilter: filter,
        setWorkspaceFilter: setFilter,
        setAllCollapsed: setCollapsed,
        unifiedRepos: popoverRepos,
        resourceSnapshot: null,
        sortOption,
        setSortOption,
        memoryMetricCopy: getResourceMemoryMetricCopy('rss'),
        collapsedRepos: collapsed ? new Set(popoverRepos.map((g) => g.repoId)) : new Set(),
        toggleRepo: () => {},
        collapsedWorktrees: new Set(),
        activeWorktreeId: null,
        toggleWorktree: () => {},
        navigateToWorktree: () => {},
        navigateToTab: () => {},
        openChat: () => {},
        sharedAgentUsage: null,
        deleteWorktree: () => {},
        handleKillSession: () => {},
        appCollapsed,
        setAppCollapsed,
        daemonUnreachable: true,
        hostSummaries: hosts
      })}
      {renderResourceUsagePopoverFooter({
        handleOpenWorkspaceCleanup: () => {},
        orphanCount: 0,
        handleKillOrphans: async () => {}
      })}
    </div>
  )
}

const scrollBy = (top: number) => async (frame: HTMLElement) => {
  frame.querySelector('.scrollbar-sleek')?.scrollTo({ top })
  await new Promise(requestAnimationFrame)
}

/** This computer without a queue, the VPS full with a waiting line, and a host that went offline. */
export const fullVps = defineFixture({ width: 512, render: () => <Popover height={1180} /> })

/** The real 46rem height: one scroll, and the list's filter and sort header stick under the cards. */
export const scrolledToList = defineFixture({
  width: 512,
  render: () => <Popover height={736} />,
  interact: scrollBy(9999)
})

export const hostWithoutQueue = defineFixture({
  width: 512,
  render: () => <Popover height={520} hosts={[localHost]} />
})

export const hostOffline = defineFixture({
  width: 512,
  render: () => <Popover height={420} hosts={[offlineHost]} />
})

/** A small window: the popover shrinks to the screen, meters fall to two a row. */
export const narrow = defineFixture({ width: 372, render: () => <Popover height={1500} /> })

export const narrowest = defineFixture({ width: 352, render: () => <Popover height={1500} /> })

export const filtered = defineFixture({
  width: 512,
  render: () => <Popover height={420} hosts={[]} />,
  interact: async (frame) => {
    const input = frame.querySelector<HTMLInputElement>('input[type="search"]')
    if (input) {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(input, 'codex')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await new Promise(requestAnimationFrame)
  }
})
