import { expect, it } from 'vitest'
import {
  DUPLICATE_PAIRED_SERVER_ENVIRONMENTS,
  DUPLICATE_PAIRED_SERVER_STATUS,
  FULL_SSH_CONFIG_TARGET_LABELS
} from './__fixtures__/full-ssh-config-hosts'
import { buildHeavyRunHostRegistry } from './heavy-run-hosts'

it('lists this computer and one row per paired server, never ssh aliases', () => {
  const hosts = buildHeavyRunHostRegistry({
    repos: [],
    settings: null,
    sshTargetLabels: FULL_SSH_CONFIG_TARGET_LABELS,
    runtimeEnvironments: DUPLICATE_PAIRED_SERVER_ENVIRONMENTS,
    runtimeStatusByEnvironmentId: DUPLICATE_PAIRED_SERVER_STATUS,
    localHostLabel: 'Mac'
  })
  expect(hosts.map((host) => host.id)).toEqual(['local', 'runtime:env-vps'])
})
