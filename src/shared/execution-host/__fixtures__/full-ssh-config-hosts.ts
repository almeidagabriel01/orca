import type { RuntimeStatus } from '../../remote-runtime/session-graph/runtime-session-contracts'
import type { RuntimeEnvironmentStatus } from '../../remote-runtime/host-status/runtime-host-status'
import type { RuntimeEnvironmentSummary } from '../execution-host-registry-entry'

/** A real-sized ~/.ssh/config: git deploy-key aliases, VMs, and one server under three aliases plus its IP. */
export const FULL_SSH_CONFIG_TARGET_LABELS: ReadonlyMap<string, string> = new Map(
  [
    'orb',
    'github.com',
    'github.com-work',
    'github.com-personal',
    'github.com-client-a',
    'github.com-client-b',
    'remoto',
    'vps',
    'vps-key',
    '100.64.0.10',
    'vps-dev'
  ].map((alias) => [alias, alias])
)

/** The same Orca server paired twice: once by its alias, once by its IP. */
export const DUPLICATE_PAIRED_SERVER_ENVIRONMENTS: RuntimeEnvironmentSummary[] = [
  { id: 'env-vps', name: 'vps' },
  { id: 'env-vps-ip', name: '100.64.0.10' }
]

function connected(runtimeId: string): RuntimeEnvironmentStatus {
  const status = {
    runtimeId,
    rendererGraphEpoch: 1,
    graphStatus: 'ready',
    authoritativeWindowId: 1,
    liveTabCount: 0,
    liveLeafCount: 0
  } satisfies RuntimeStatus
  return { status, checkedAt: 1 }
}

export const DUPLICATE_PAIRED_SERVER_STATUS: ReadonlyMap<string, RuntimeEnvironmentStatus> =
  new Map([
    ['env-vps', connected('runtime-vps')],
    ['env-vps-ip', connected('runtime-vps')]
  ])
