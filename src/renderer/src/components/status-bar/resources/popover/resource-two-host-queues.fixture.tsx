import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { ResourceHostSummary } from './resource-host-summary'
import { ResourceHostCards } from './resource-usage-hosts-summary'

const NOW = 1_795_450_000_000
const MIN = 60_000
const GIB = 1024 ** 3

const job = (pid: number, repo: string, wt: string, fields: Partial<HeavyCommandJob>) =>
  ({
    pid,
    status: 'waiting',
    slot: null,
    position: null,
    ordered: true,
    direct: false,
    extra: false,
    queuedAt: NOW - 5 * MIN,
    startedAt: null,
    cwd: `/work/${repo}/${wt}`,
    command: 'pnpm check:changed',
    workspace: { worktreeId: `${repo}::/work/${repo}/${wt}`, repoName: repo, worktreeName: wt },
    ...fields
  }) satisfies HeavyCommandJob

const macQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 1,
  controls: true,
  jobs: [
    job(301, 'ProOps', 'main', {
      status: 'running',
      slot: 1,
      startedAt: NOW - 8 * MIN,
      command: 'xcodebuild -scheme ProOps build'
    }),
    job(302, 't3code', 'feature-ui', { position: 1, command: 'pnpm test' })
  ]
}

const vpsQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 2,
  controls: true,
  jobs: [
    job(401, 'Tudo-Azul', 'main', {
      status: 'running',
      slot: 1,
      startedAt: NOW - 12 * MIN,
      command: 'npm -w web run build:test'
    }),
    job(402, 'orca-ref', 'ridgehead', {
      status: 'running',
      slot: 2,
      startedAt: NOW - 3 * MIN,
      command: 'vps-heavy --group orca-check pnpm check:changed'
    }),
    job(403, 'orca-ref', 'ridgehead', {
      position: 1,
      command: 'vps-heavy --group orca-check pnpm typecheck'
    }),
    job(404, 'Tudo-Azul', 'hotfix', { position: 2, command: 'npx playwright test' }),
    job(405, 'ProOps', 'main', { position: 3, command: 'pnpm build' })
  ]
}

const host = (
  id: string,
  label: string,
  isLocal: boolean,
  cores: number,
  queue: HeavyCommandQueue
): ResourceHostSummary => ({
  id,
  label,
  isLocal,
  orca: { cpu: 10, memory: 1 * GIB },
  machine: {
    cpuPercent: 55,
    cpuCores: cores,
    memory: { used: 12 * GIB, total: 32 * GIB },
    swap: null,
    disk: null,
    loadAverage: null,
    outsideOrca: null,
    heavyQueue: queue
  },
  counts: { terminals: 4, agents: 2, commands: 1 },
  notice: null
})

const hosts = [host('local', 'Mac', true, 10, macQueue), host('env-vps', 'vps', false, 8, vpsQueue)]

/** Both paired hosts, each with its own heavy queue (macOS 1 slot, Linux 2 slots). */
export const twoHostQueues = defineFixture({
  width: 512,
  render: () => <ResourceHostCards hosts={hosts} />
})

export const twoHostQueuesNarrow = defineFixture({
  width: 352,
  render: () => <ResourceHostCards hosts={hosts} />
})
