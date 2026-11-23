import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { OutsideOrcaProcessGroup } from '../../../../../../shared/diagnostics/process-stats-types'
import type { HostMachineTotals } from '../../host-connections/runtime-host-resources'
import type { ResourceHostSummary } from './resource-host-summary'
import { OutsideOrcaSections } from './resource-usage-outside-orca'

const MIB = 1024 ** 2
const GIB = 1024 ** 3

const group = (
  kind: OutsideOrcaProcessGroup['kind'],
  name: string,
  cpu: number,
  memory: number,
  processCount = 1
): OutsideOrcaProcessGroup => ({ kind, name, cpu, memory, processCount })

const machine = (outsideOrca: OutsideOrcaProcessGroup[] | null): HostMachineTotals => ({
  cpuPercent: 31,
  cpuCores: 8,
  memory: { used: 12 * GIB, total: 16 * GIB },
  swap: null,
  disk: null,
  loadAverage: null,
  outsideOrca
})

const hosts: ResourceHostSummary[] = [
  {
    id: 'local',
    label: 'This computer',
    isLocal: true,
    orca: { cpu: 18.4, memory: 1.2 * GIB },
    machine: machine([
      group('app', 'Google Chrome', 64.2, 3.4 * GIB, 27),
      group('app', 'Slack', 8.1, 812 * MIB, 6),
      group('app', 'Docker', 22.7, 2.1 * GIB, 9),
      group('command', 'WindowServer', 14.3, 410 * MIB),
      group('app', 'Spotify', 3.2, 380 * MIB, 4),
      group('command', 'mds_stores', 11.5, 96 * MIB, 2),
      group('app', 'Figma', 6.4, 1.1 * GIB, 5),
      group('command', 'kernel_task', 9.8, 52 * MIB),
      group('app', 'Finder', 0.4, 140 * MIB),
      group('command', 'node', 1.2, 230 * MIB, 3),
      group('command', 'launchd', 0.1, 24 * MIB)
    ]),
    counts: { terminals: 5, agents: 2, commands: 1 },
    notice: null
  },
  {
    id: 'env-vps',
    label: 'vps',
    isLocal: false,
    orca: { cpu: 3.1, memory: 412 * MIB },
    machine: machine([
      group('container', 'harvey-harvey-1', 12.6, 840 * MIB, 5),
      group('container', 'google-maps-scraper-kit-1', 4.3, 610 * MIB, 14),
      group('command', 'dockerd', 0.8, 64 * MIB),
      group('command', 'postgres', 2.1, 180 * MIB, 7),
      group('kernel', 'kernel', 1.4, 0, 132),
      group('command', 'tailscaled', 0.7, 49 * MIB)
    ]),
    counts: { terminals: 3, agents: 1, commands: 0 },
    notice: null
  },
  {
    id: 'env-old',
    label: 'old-server',
    isLocal: false,
    orca: null,
    machine: machine(null),
    counts: null,
    notice: null
  }
]

export const byCpu = defineFixture({
  width: 448,
  render: () => <OutsideOrcaSections hosts={hosts} sortOption="cpu" />
})

export const byMemoryExpanded = defineFixture({
  width: 448,
  render: () => <OutsideOrcaSections hosts={hosts} sortOption="memory" />,
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click()
    await new Promise(requestAnimationFrame)
  }
})
