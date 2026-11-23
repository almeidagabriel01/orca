import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { renderResourceUsageSummary } from './resource-usage-popover-summary'
import { renderResourceHostsSummary } from './resource-usage-hosts-summary'
import { ResourceUsageStatusSegment } from '../ResourceUsageStatusSegment'
import type { MemorySnapshot } from '../../../../../../shared/diagnostics/process-stats-types'

const GIB = 1024 ** 3

const fixtureOwnerSplit = {
  orca: { memory: 987842478 },
  agents: { memory: 6023725056 },
  yourProcesses: { memory: 2029359923 }
}

export const ownerBreakdown = defineFixture({
  // Popover is 26rem wide; the frame adds 16px padding on each side.
  width: 448,
  render: () =>
    renderResourceUsageSummary({
      ownerSplit: fixtureOwnerSplit,
      commitBadgeLabel: null,
      commitToneClass: null,
      orphanCount: 2
    })
})

export const orphanSummary = defineFixture({
  width: 420,
  render: () =>
    renderResourceUsageSummary({
      ownerSplit: fixtureOwnerSplit,
      commitBadgeLabel: null,
      commitToneClass: null,
      orphanCount: 2
    })
})

const windowsSnapshot: MemorySnapshot = {
  app: {
    cpu: 138,
    memory: 2147483648,
    main: { cpu: 38, memory: 536870912 },
    renderer: { cpu: 100, memory: 1610612736 },
    other: { cpu: 0, memory: 0 },
    history: []
  },
  worktrees: [],
  host: {
    totalMemory: 17179869184,
    freeMemory: 8589934592,
    availableMemory: 8589934592,
    availableMemorySource: 'free-memory',
    usedMemory: 8589934592,
    memoryUsagePercent: 50,
    cpuCoreCount: 8,
    loadAverage1m: 0
  },
  processMemoryMetric: 'working-set',
  processCommitMetric: 'private-bytes',
  totalCpu: 138,
  totalMemory: 2147483648,
  totalPrivateMemory: 3221225472,
  collectedAt: 1
}

const crowdedSnapshot: MemorySnapshot = {
  ...windowsSnapshot,
  worktrees: Array.from({ length: 15 }, (_, index) => ({
    worktreeId: `workspace-${index + 1}`,
    worktreeName: `Workspace ${index + 1}`,
    repoId: 'fixture-project',
    repoName: 'Project',
    cpu: 0,
    memory: 0,
    sessions: [],
    history: []
  }))
}

export const shortWindowPopover = defineFixture({
  width: 440,
  store: { memorySnapshot: crowdedSnapshot, workspaceSessionReady: true },
  setup: () => {
    window.api.memory.getSnapshot = async () => crowdedSnapshot
    window.api.pty.listSessions = async () => []
  },
  render: () => (
    <div className="flex h-90 items-end justify-end">
      <ResourceUsageStatusSegment />
    </div>
  ),
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('button')?.click()
    await new Promise(requestAnimationFrame)
    const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]')
    if (popover) {
      popover.style.maxHeight = '320px'
    }
  }
})

export const shortWindowOrphanCleanup = defineFixture({
  ...shortWindowPopover,
  setup: () => {
    shortWindowPopover.setup?.()
    window.api.pty.listSessions = async () => [
      { id: 'fixture-orphan', cwd: '/workspace', title: 'Terminal', agentOwnership: 'absent' }
    ]
  }
})

export const hostsSummary = defineFixture({
  width: 448,
  render: () =>
    renderResourceHostsSummary([
      {
        id: 'local',
        label: 'This computer',
        isLocal: true,
        orca: { cpu: 18.4, memory: 1288490188 },
        machine: {
          cpuPercent: 23.4,
          cpuCores: 8,
          memory: { used: 12.1 * GIB, total: 16 * GIB },
          swap: { used: 1.2 * GIB, total: 4 * GIB },
          disk: { used: 210 * GIB, total: 460 * GIB },
          loadAverage: [2.41, 1.97, 1.62]
        },
        counts: { terminals: 5, agents: 2, commands: 1 },
        notice: null
      },
      {
        id: 'env-build',
        label: 'build-box',
        isLocal: false,
        orca: { cpu: 3.1, memory: 412316860 },
        // Older server: RAM, cores and nothing else.
        machine: {
          cpuPercent: null,
          cpuCores: 4,
          memory: { used: 2.6 * GIB, total: 7.8 * GIB },
          swap: null,
          disk: null,
          loadAverage: null
        },
        counts: { terminals: 3, agents: 1, commands: 0 },
        notice: null
      },
      {
        id: 'env-old',
        label: 'old-server',
        isLocal: false,
        orca: null,
        machine: null,
        counts: null,
        notice: 'Update old-server to see its resources.'
      }
    ])
})
