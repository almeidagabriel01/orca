import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import type { ResourceHostSummary } from './resource-host-summary'
import { ResourceHostCards } from './resource-usage-hosts-summary'

// Worst cases for one queue row: the workspace and command must stay readable and the actions reachable.
const NOW = 1_795_450_000_000
const MIN = 60_000
const GIB = 1024 ** 3

const LONG_PROJECT = 'customer-billing-platform-monorepo-with-a-very-long-name'
const LONG_WORKTREE = 'feature-recurring-invoices-redesign'
const PATH_COMMAND = `node /home/dev/projects/${'deeply-nested-folder/'.repeat(17)}scripts/build.mjs`
const SPACED_COMMAND = `pnpm vitest run ${Array.from({ length: 22 }, (_, i) => `src/module-${i}/case.test.ts`).join(' ')}`

const job = (pid: number, fields: Partial<HeavyCommandJob>): HeavyCommandJob => ({
  pid,
  status: 'waiting',
  slot: null,
  position: null,
  ordered: true,
  direct: false,
  extra: false,
  queuedAt: NOW - 5 * MIN,
  startedAt: null,
  cwd: '/home/dev/projects/app',
  command: 'pnpm test',
  workspace: {
    worktreeId: 'wt-long',
    repoName: LONG_PROJECT,
    worktreeName: LONG_WORKTREE
  },
  ...fields
})

const host: ResourceHostSummary = {
  id: 'env-extreme',
  label: 'vps',
  isLocal: false,
  orca: { cpu: 3, memory: 0.4 * GIB },
  machine: {
    cpuPercent: 71,
    cpuCores: 8,
    memory: { used: 20 * GIB, total: 32 * GIB },
    swap: { used: 0, total: 0 },
    disk: { used: 120 * GIB, total: 193 * GIB },
    loadAverage: [5, 4, 3],
    outsideOrca: null,
    heavyQueue: {
      readAt: NOW,
      slots: 1,
      controls: true,
      jobs: [
        job(1, {
          status: 'running',
          slot: 1,
          ordered: false,
          direct: true,
          workspace: undefined,
          cwd: `/home/dev/${'very-long-directory-name/'.repeat(4)}app`,
          command: PATH_COMMAND
        }),
        job(2, { position: 1, command: SPACED_COMMAND }),
        job(3, { position: 2, command: PATH_COMMAND }),
        job(4, { ordered: false, direct: true, command: SPACED_COMMAND })
      ]
    }
  },
  counts: { terminals: 1, agents: 0, commands: 1 },
  notice: null
}

const expandAll = async (frame: HTMLElement): Promise<void> => {
  for (const button of frame.querySelectorAll<HTMLButtonElement>('button[data-queue-command]')) {
    button.click()
  }
  await new Promise(requestAnimationFrame)
}

const render = (): React.JSX.Element => <ResourceHostCards hosts={[host]} />

export const wide = defineFixture({ width: 512, render })
export const wideExpanded = defineFixture({ width: 512, render, interact: expandAll })
export const narrow = defineFixture({ width: 352, render })
export const narrowExpanded = defineFixture({ width: 352, render, interact: expandAll })

// Opens the ⋯ menu on one row: 0 is the running slot, 3 the flock job still waiting.
const openMenu =
  (rowIndex: number) =>
  async (frame: HTMLElement): Promise<void> => {
    frame
      .querySelectorAll('[data-queue-row]')
      [rowIndex]?.querySelector('[data-queue-menu]')
      ?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      )
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

export const wideRunningMenu = defineFixture({ width: 512, render, interact: openMenu(0) })
export const wideFlockMenu = defineFixture({ width: 512, render, interact: openMenu(3) })
export const narrowRunningMenu = defineFixture({ width: 352, render, interact: openMenu(0) })
export const narrowFlockMenu = defineFixture({ width: 352, render, interact: openMenu(3) })
