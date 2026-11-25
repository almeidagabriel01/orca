import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { ResourceHostSummary } from './resource-host-summary'
import { ResourceHostCards } from './resource-usage-hosts-summary'
import { HeavyJobMoveCheckContext } from './resource-heavy-queue-move-items'
import type { checkHeavyJobMove } from './resource-heavy-job-move'

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
    argv: ['pnpm', 'check:changed'],
    workspace: { worktreeId: `${repo}::/work/${repo}/${wt}`, repoName: repo, worktreeName: wt },
    ...fields
  }) satisfies HeavyCommandJob

const macQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 1,
  controls: true,
  canStop: true,
  canMoveHost: true,
  hostname: 'gabriel-mac',
  peers: [{ name: 'vps', alias: 'vps', hostname: 'vps-host' }],
  jobs: [
    job(301, 'ProOps', 'main', {
      status: 'running',
      slot: 1,
      startedAt: NOW - 8 * MIN,
      command: 'xcodebuild -scheme ProOps build'
    }),
    job(302, 't3code', 'feature-ui', { position: 1, command: 'pnpm test' }),
    job(303, 'Tudo-Azul', 'main', {
      position: 2,
      command: 'npm -w web run lint',
      movedFrom: 'vps-host'
    })
  ]
}

const vpsQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 2,
  controls: true,
  canStop: true,
  canMoveHost: true,
  hostname: 'vps-host',
  peers: [{ name: 'Mac', alias: 'mac', hostname: 'gabriel-mac' }],
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
    job(405, 'ProOps', 'main', { position: 3, command: 'pnpm build' }),
    job(406, 'Tudo-Azul', 'main', {
      status: 'moved',
      queuedAt: NOW - 2 * MIN,
      startedAt: NOW - 2 * MIN,
      command: 'npm -w web run lint',
      movedTo: { peer: 'Mac', alias: 'mac', hostname: 'gabriel-mac' }
    })
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

// The xcodebuild job cannot run on the Linux host; every other job can move.
const cannedCheck: typeof checkHeavyJobMove = async (_source, target, job) =>
  job.pid === 301
    ? { ok: false, blockers: [{ code: 'executable_missing', detail: 'xcodebuild' }] }
    : {
        ok: true,
        plan: {
          peer: { name: target.label, alias: target.id, hostname: target.queue.hostname ?? null },
          request: {
            remoteUrl: 'github.com/example/repo',
            branch: 'main',
            commit: '0'.repeat(40),
            relativeDir: '',
            argv: job.argv ?? [],
            prepare: false
          }
        }
      }

function CardsWithCannedMoves(): React.JSX.Element {
  return (
    <HeavyJobMoveCheckContext.Provider value={cannedCheck}>
      <ResourceHostCards hosts={hosts} />
    </HeavyJobMoveCheckContext.Provider>
  )
}

const openMenuOf = (command: string) => async (frame: HTMLElement) => {
  const row = [...frame.querySelectorAll('li[data-queue-row]')].find((li) =>
    li.textContent?.includes(command)
  )
  row
    ?.querySelector('button[data-queue-menu]')
    ?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
    )
  await new Promise((resolve) => setTimeout(resolve, 150))
}

/** A waiting Linux job's menu: "Run on Mac" is offered. */
export const runOnMacMenu = defineFixture({
  width: 512,
  render: () => <CardsWithCannedMoves />,
  interact: openMenuOf('npx playwright test')
})

export const runOnMacMenuNarrow = defineFixture({ ...runOnMacMenu, width: 352 })

/** The running xcodebuild job's menu: "Run on vps" is off and says why. */
export const runOnBlockedMenu = defineFixture({
  width: 512,
  render: () => <CardsWithCannedMoves />,
  interact: openMenuOf('xcodebuild -scheme ProOps build')
})

export const runOnBlockedMenuNarrow = defineFixture({ ...runOnBlockedMenu, width: 352 })
