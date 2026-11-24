import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import type {
  UnifiedProjectGroup,
  UnifiedSessionRow,
  UnifiedWorktreeRow
} from '../workspace-attribution/resource-usage-merge-types'
import type { ResourceHostSummary } from './resource-host-summary'

const NOW = 1_795_450_000_000
const MIN = 60_000
const GIB = 1024 ** 3
const MIB = 1024 ** 2

const job = (pid: number, fields: Partial<HeavyCommandJob>): HeavyCommandJob => ({
  pid,
  status: 'waiting',
  slot: null,
  position: null,
  ordered: true,
  direct: false,
  extra: false,
  queuedAt: NOW - MIN,
  startedAt: null,
  cwd: '/home/dev/projects/app',
  command: 'pnpm test',
  ...fields
})

const ws = (repoName: string, worktreeName: string) => ({
  worktreeId: `${repoName}::/home/dev/${worktreeName}`,
  repoName,
  worktreeName
})

export const fullQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 2,
  controls: true,
  canStop: true,
  jobs: [
    job(101, {
      status: 'running',
      slot: 1,
      ordered: false,
      direct: true,
      queuedAt: NOW - 42 * MIN,
      cwd: '/home/dev/projects/app/platy',
      command: 'bash ./scripts/gate-app-sql.sh'
    }),
    job(102, {
      status: 'running',
      slot: 2,
      ordered: false,
      queuedAt: NOW - 21 * MIN,
      startedAt: NOW - 19 * MIN,
      workspace: ws('shop', 'porpoise'),
      command:
        'bash -c cd apps/web && npm -w web run build:test && npx playwright test --project=chromium tests/e2e/smoke.spec.ts'
    }),
    job(104, {
      position: 1,
      queuedAt: NOW - 38 * MIN,
      workspace: ws('orca', 'hydra'),
      command: 'timeout 1500 pnpm check:changed --base=fork-main --maxWorkers=2'
    }),
    job(105, {
      position: 2,
      queuedAt: NOW - 27 * MIN,
      workspace: ws('orca', 'snakehead'),
      command: 'timeout 600 pnpm fixtures:shot status-bar/usage --theme both'
    }),
    job(106, {
      position: 3,
      queuedAt: NOW - 8 * MIN,
      cwd: '/home/dev/projects/site/apps/web',
      command: 'pnpm test:e2e e2e/safe-area-landscape.spec.ts'
    }),
    job(107, {
      ordered: false,
      direct: true,
      queuedAt: NOW - 3 * MIN,
      cwd: '/home/dev/projects/app/tarpon',
      command: 'node --test src/lib/expo-router-linking.test.cjs'
    })
  ]
}

export const localHost: ResourceHostSummary = {
  id: 'local',
  label: 'This computer',
  isLocal: true,
  orca: { cpu: 18.4, memory: 1.2 * GIB },
  machine: {
    cpuPercent: 23.4,
    cpuCores: 8,
    memory: { used: 12.1 * GIB, total: 16 * GIB },
    swap: { used: 1.2 * GIB, total: 4 * GIB },
    disk: { used: 210 * GIB, total: 460 * GIB },
    loadAverage: [2.41, 1.97, 1.62],
    outsideOrca: null,
    heavyQueue: null
  },
  counts: { terminals: 13, agents: 0, commands: 0 },
  notice: null
}

export const vpsHost: ResourceHostSummary = {
  id: 'env-vps',
  label: 'vps',
  isLocal: false,
  orca: { cpu: 3.1, memory: 412 * MIB },
  machine: {
    cpuPercent: 94,
    cpuCores: 8,
    memory: { used: 28.9 * GIB, total: 32 * GIB },
    swap: { used: 0, total: 0 },
    disk: { used: 131 * GIB, total: 193 * GIB },
    loadAverage: [9.12, 7.4, 5.02],
    outsideOrca: [
      { kind: 'container', name: 'postgres', processCount: 3, cpu: 12.5, memory: 1.4 * GIB },
      { kind: 'command', name: 'node', processCount: 6, cpu: 182, memory: 3.1 * GIB }
    ],
    heavyQueue: fullQueue
  },
  counts: { terminals: 6, agents: 3, commands: 2 },
  notice: null
}

export const offlineHost: ResourceHostSummary = {
  id: 'env-old',
  label: 'old-server',
  isLocal: false,
  orca: null,
  machine: null,
  counts: null,
  notice: "Couldn't reach old-server. Its numbers are missing."
}

export const popoverHosts: ResourceHostSummary[] = [localHost, vpsHost, offlineHost]

const session = (
  sessionId: string,
  label: string,
  cpu: number,
  memory: number
): UnifiedSessionRow => ({
  sessionId,
  paneKey: null,
  pid: 4000 + sessionId.length,
  label,
  bound: true,
  agentOwnership: 'absent',
  tabId: `tab-${sessionId}`,
  cpu,
  memory,
  hasLocalSamples: true
})

const worktree = (
  repoId: string,
  repoName: string,
  worktreeName: string,
  sessions: UnifiedSessionRow[]
): UnifiedWorktreeRow => ({
  worktreeId: `${repoId}::${worktreeName}`,
  worktreeName,
  repoId,
  repoName,
  cpu: sessions.reduce((sum, s) => sum + (s.cpu ?? 0), 0),
  memory: sessions.reduce((sum, s) => sum + (s.memory ?? 0), 0),
  history: [2, 4, 3, 8, 6, 9, 7],
  hasLocalSamples: true,
  isRemote: false,
  sessions,
  browsers: []
})

const group = (
  repoId: string,
  repoName: string,
  worktrees: UnifiedWorktreeRow[]
): UnifiedProjectGroup => ({
  repoId,
  repoName,
  cpu: worktrees.reduce((sum, w) => sum + (w.cpu ?? 0), 0),
  memory: worktrees.reduce((sum, w) => sum + (w.memory ?? 0), 0),
  hasRemoteChildren: false,
  worktrees
})

export const popoverRepos: UnifiedProjectGroup[] = [
  group('orca', 'orca', [
    worktree('orca', 'orca', 'hammerhead', [
      session('s1', 'Claude · redesign popover', 64.2, 2.4 * GIB),
      session('s2', 'pnpm dev', 8.1, 610 * MIB)
    ]),
    worktree('orca', 'orca', 'snakehead', [session('s3', 'zsh', 0.2, 12 * MIB)])
  ]),
  group('shop', 'shop', [
    worktree('shop', 'shop', 'porpoise', [session('s4', 'Codex · checkout fix', 3.4, 380 * MIB)])
  ])
]

export const popoverOwnerSplit = {
  orca: { memory: 1.2 * GIB },
  agents: { memory: 6 * GIB },
  yourProcesses: { memory: 2 * GIB }
}
