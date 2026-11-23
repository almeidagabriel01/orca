import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { HostMachineTotals } from '../../host-connections/runtime-host-resources'
import type { ResourceHostSummary } from './resource-host-summary'
import { HeavyQueueSections } from './resource-usage-heavy-queue'

const NOW = 1_795_450_000_000
const MIN = 60_000
const GIB = 1024 ** 3

const job = (pid: number, fields: Partial<HeavyCommandJob>): HeavyCommandJob => ({
  pid,
  status: 'waiting',
  slot: null,
  position: null,
  ordered: false,
  direct: false,
  extra: false,
  queuedAt: NOW - MIN,
  startedAt: null,
  cwd: '/home/dev/orca/workspaces/orca/hydra',
  command: 'pnpm test',
  ...fields
})

const workspace = (repoName: string, worktreeName: string) => ({
  worktreeId: `${repoName}::/home/dev/${worktreeName}`,
  repoName,
  worktreeName
})

const machine = (heavyQueue: HeavyCommandQueue | null): HostMachineTotals => ({
  cpuPercent: 64,
  cpuCores: 8,
  memory: { used: 21 * GIB, total: 32 * GIB },
  swap: null,
  disk: null,
  loadAverage: null,
  outsideOrca: null,
  heavyQueue
})

const host = (id: string, label: string, queue: HeavyCommandQueue | null): ResourceHostSummary => ({
  id,
  label,
  isLocal: id === 'local',
  orca: { cpu: 12, memory: 2 * GIB },
  machine: machine(queue),
  counts: { terminals: 4, agents: 2, commands: 1 },
  notice: null
})

const busyQueue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 2,
  controls: true,
  jobs: [
    job(101, {
      status: 'running',
      slot: 1,
      direct: true,
      queuedAt: NOW - 42 * MIN,
      cwd: '/home/dev/projects/app/platy',
      command: 'bash ./scripts/gate-app-sql.sh'
    }),
    job(102, {
      status: 'running',
      slot: 2,
      queuedAt: NOW - 21 * MIN,
      startedAt: NOW - 19 * MIN,
      workspace: workspace('shop', 'porpoise'),
      command:
        'bash -c cd apps/web && rm -rf .next-test && npm -w web run build:test > /tmp/build-test.log 2>&1 && npx playwright test --config=tests/playwright.config.ts --project=chromium --project=mobile-chrome --workers=1 tests/e2e/smoke.spec.ts tests/e2e/billing/cupons.spec.ts'
    }),
    job(103, {
      status: 'running',
      extra: true,
      queuedAt: NOW - 6 * MIN,
      startedAt: NOW - 2 * MIN,
      workspace: workspace('orca', 'cardinalfish'),
      command: 'pnpm check:changed --maxWorkers=4'
    }),
    job(104, {
      position: 1,
      ordered: true,
      queuedAt: NOW - 38 * MIN,
      workspace: workspace('orca', 'hydra'),
      command: 'timeout 1500 pnpm check:changed --base=fork/fork-main --maxWorkers=2'
    }),
    job(105, {
      position: 2,
      ordered: true,
      queuedAt: NOW - 27 * MIN,
      workspace: workspace('orca', 'snakehead'),
      command: 'timeout 600 pnpm fixtures:shot status-bar/usage/UsagePaceSessions --theme both'
    }),
    job(106, {
      position: 3,
      ordered: true,
      queuedAt: NOW - 8 * MIN,
      cwd: '/home/dev/projects/site/apps/web',
      command: 'pnpm test:e2e e2e/safe-area-landscape.spec.ts'
    }),
    job(107, {
      direct: true,
      queuedAt: NOW - 3 * MIN,
      cwd: '/home/dev/projects/app/tarpon',
      command: 'node --test src/lib/expo-router-linking.test.cjs'
    })
  ]
}

const hosts: ResourceHostSummary[] = [
  host('local', 'This computer', { readAt: NOW, slots: 1, controls: true, jobs: [] }),
  host('env-vps', 'vps', busyQueue),
  host('env-old', 'old-server', {
    readAt: NOW,
    slots: 1,
    controls: false,
    jobs: [
      job(201, { status: 'running', slot: 1, startedAt: NOW - 4 * MIN, command: 'make release' }),
      job(202, { queuedAt: NOW - 90_000, command: 'cargo build --release' })
    ]
  }),
  host('env-none', 'no-queue', null)
]

const pointerDown = (element: Element | null | undefined): void => {
  element?.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
  )
}

export const queues = defineFixture({
  width: 448,
  render: () => <HeavyQueueSections hosts={hosts} />
})

export const commandExpanded = defineFixture({
  width: 448,
  render: () => <HeavyQueueSections hosts={hosts} />,
  interact: async (frame) => {
    frame
      .querySelectorAll<HTMLButtonElement>('button[aria-label="Show the whole command"]')[1]
      ?.click()
    await new Promise(requestAnimationFrame)
  }
})

export const actionsMenu = defineFixture({
  width: 448,
  render: () => <HeavyQueueSections hosts={hosts} />,
  interact: async (frame) => {
    pointerDown(frame.querySelectorAll('button[aria-label="Queue actions"]')[1])
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
})

const confirmFrom = (item: string) => async (frame: HTMLElement) => {
  pointerDown(frame.querySelectorAll('button[aria-label="Queue actions"]')[1])
  await new Promise((resolve) => setTimeout(resolve, 150))
  const menuItem = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
    el.textContent?.startsWith(item)
  )
  menuItem?.click()
  await new Promise((resolve) => setTimeout(resolve, 150))
}

export const removeConfirm = defineFixture({
  width: 448,
  render: () => <HeavyQueueSections hosts={hosts} />,
  interact: confirmFrom('Remove from queue')
})

export const startNowConfirm = defineFixture({
  width: 448,
  render: () => <HeavyQueueSections hosts={hosts} />,
  interact: confirmFrom('Start now')
})
