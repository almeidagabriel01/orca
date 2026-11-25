import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { OutsideQueueProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import { ResourceHostCards } from './resource-usage-hosts-summary'
import { ResourceFoldAllToolbar } from './resource-host-card-fold'
import { setAllHostSectionsCollapsed } from './resource-host-section'
import type { ResourceHostSummary } from './resource-host-summary'
import { localHost, vpsHost } from './resource-manager-popover-fixtures'

const GIB = 1024 ** 3
const ws = (repoName: string, worktreeName: string) => ({
  worktreeId: `${repoName}::/home/dev/${worktreeName}`,
  repoName,
  worktreeName
})

const macGroups: OutsideQueueProcessGroup[] = [
  {
    name: 'iOS Simulator',
    kind: 'app',
    cpu: 380,
    memory: 9.2 * GIB,
    count: 3,
    workspace: ws('orca-ref', 'narwhal-2')
  },
  {
    name: 'Google Chrome',
    kind: 'app',
    launcher: 'lighthouse',
    cpu: 240,
    memory: 3.1 * GIB,
    count: 14,
    folder: 'site'
  },
  {
    name: 'node vitest',
    kind: 'command',
    cpu: 130,
    memory: 1.8 * GIB,
    count: 4,
    workspace: ws('orca-ref', 'narwhal-2')
  },
  { name: 'xcodebuild', kind: 'command', cpu: 95, memory: 1.4 * GIB, count: 2 },
  { name: 'OrbStack', kind: 'app', cpu: 60, memory: 4 * GIB, count: 9 }
]

const mac: ResourceHostSummary = {
  ...localHost,
  machine: {
    ...localHost.machine!,
    cpuPercent: 100,
    loadAverage: [224.1, 180.3, 120.9],
    heavyQueue: { readAt: 0, slots: 1, controls: true, jobs: [] },
    outsideQueue: macGroups
  }
}
const vps: ResourceHostSummary = {
  ...vpsHost,
  machine: {
    ...vpsHost.machine!,
    outsideQueue: [
      { name: 'harvey-harvey-1', kind: 'container', cpu: 210, memory: 2.4 * GIB, count: 5 },
      {
        name: 'node vitest',
        kind: 'command',
        cpu: 130,
        memory: 1.8 * GIB,
        count: 4,
        workspace: ws('orca', 'cardinalfish')
      }
    ] satisfies OutsideQueueProcessGroup[]
  }
}
const noQueue: ResourceHostSummary = {
  ...mac,
  id: 'nq',
  label: 'no-queue',
  machine: { ...mac.machine!, heavyQueue: null }
}

const Cards = ({ hosts }: { hosts: ResourceHostSummary[] }): React.JSX.Element => (
  <>
    <ResourceFoldAllToolbar onSetAll={setAllHostSectionsCollapsed} />
    <ResourceHostCards hosts={hosts} />
  </>
)

export const macOverloaded = defineFixture({ width: 448, render: () => <Cards hosts={[mac]} /> })
export const macOverloadedNarrow = defineFixture({
  width: 320,
  render: () => <Cards hosts={[mac]} />
})
export const vpsMixed = defineFixture({
  width: 448,
  render: () => <Cards hosts={[vps]} />
})
export const vpsMixedNarrow = defineFixture({
  width: 320,
  render: () => <Cards hosts={[vps, noQueue]} />
})

// Own ids, so the folds these remember never reach the other fixtures.
const foldHosts = [
  { ...mac, id: 'fold-mac' },
  { ...vps, id: 'fold-vps' }
]
// Folds the Mac's sections (metrics, queue, outside the queue) and the whole vps card.
const foldSome = async (frame: HTMLElement): Promise<void> => {
  const [macCard, vpsCard] = frame.querySelectorAll<HTMLElement>('li[data-host-card]')
  const [, ...macSections] = macCard.querySelectorAll<HTMLButtonElement>(
    'button[aria-expanded="true"]:not([data-queue-command])'
  )
  for (const button of macSections) {
    button.click()
  }
  vpsCard.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.click()
  await new Promise(requestAnimationFrame)
}
export const folded = defineFixture({
  width: 448,
  render: () => <Cards hosts={foldHosts} />,
  interact: foldSome
})
export const foldedNarrow = defineFixture({
  width: 320,
  render: () => <Cards hosts={foldHosts} />,
  interact: foldSome
})
