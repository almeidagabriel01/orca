import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import { HostHeavyQueue } from './resource-usage-heavy-queue'

const NOW = 1_795_450_000_000
const MIN = 60_000

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
  cwd: '/home/dev/projects/app',
  command: 'pnpm test',
  ...fields
})

const waiter = (pid: number, position: number, minutes: number, cwd: string, command: string) =>
  job(pid, { position, ordered: true, queuedAt: NOW - minutes * MIN, cwd, command })

const queue: HeavyCommandQueue = {
  readAt: NOW,
  slots: 2,
  controls: true,
  jobs: [
    job(4101, {
      status: 'running',
      slot: 1,
      queuedAt: NOW - 14 * MIN,
      startedAt: NOW - 12 * MIN,
      cwd: '/home/dev/actions-runner-3/_work/ProOps/ProOps',
      command: 'pnpm vitest run --project financial'
    }),
    job(4102, {
      status: 'running',
      slot: 2,
      queuedAt: NOW - 9 * MIN,
      startedAt: NOW - 6 * MIN,
      cwd: '/home/dev/actions-runner-1/_work/Personal-ProOps-app/Personal-ProOps-app',
      command: 'pnpm lint && pnpm typecheck'
    }),
    waiter(
      4103,
      1,
      8,
      '/home/dev/actions-runner-2/_work/ProOps/ProOps',
      'GitHub Actions · ProOps Test Suite / e2e-financial: pnpm playwright test e2e/financial'
    ),
    waiter(
      4104,
      2,
      6,
      '/home/dev/projects/Personal-ProOps-app',
      'pnpm build --filter Personal-ProOps-app'
    ),
    waiter(
      4105,
      3,
      4,
      '/home/dev/actions-runner-3/_work/ProOps/ProOps',
      'GitHub Actions · ProOps Test Suite / unit: pnpm vitest run'
    ),
    waiter(4106, 4, 2, '/home/dev/projects/ProOps', 'docker compose build api worker'),
    job(4107, {
      direct: true,
      queuedAt: NOW - MIN,
      cwd: '/home/dev/projects/ProOps/infra',
      command: 'flock ~/.cache/vps-heavy/lock terraform plan'
    })
  ]
}

function Queue(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <HostHeavyQueue hostId="env-vps" label="vps" queue={queue} />
    </div>
  )
}

const frames = (count: number) => async (): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await new Promise(requestAnimationFrame)
  }
}

export const handles = defineFixture({ width: 512, render: () => <Queue /> })

export const midDrag = defineFixture({
  width: 512,
  render: () => <Queue />,
  interact: async (frame) => {
    const grip = frame.querySelectorAll<HTMLElement>('[data-queue-grip]')[3]
    if (!grip) {
      return
    }
    const box = grip.getBoundingClientRect()
    const at = (dy: number) => ({
      bubbles: true,
      isPrimary: true,
      button: 0,
      buttons: 1,
      pointerType: 'mouse',
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2 + dy
    })
    grip.dispatchEvent(new PointerEvent('pointerdown', at(0)))
    for (const dy of [-6, -40, -70, -90]) {
      document.dispatchEvent(new PointerEvent('pointermove', at(dy)))
      await frames(2)()
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
})

export const rowMenu = defineFixture({
  width: 512,
  render: () => <Queue />,
  interact: async (frame) => {
    frame
      .querySelectorAll('button[aria-label="Queue actions"]')[3]
      ?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      )
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
})
