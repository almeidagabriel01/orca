import { buildHeavyRunHostRegistry } from '../../../../../../shared/execution-host/heavy-run-hosts'
import {
  DUPLICATE_PAIRED_SERVER_ENVIRONMENTS,
  DUPLICATE_PAIRED_SERVER_STATUS,
  FULL_SSH_CONFIG_TARGET_LABELS
} from '../../../../../../shared/execution-host/__fixtures__/full-ssh-config-hosts'
import type { RunHostChoiceOption } from './ProjectRunHostSetting'

/** Options built by the real heavy-host registry from a full ssh config and a twice-paired server. */
export const realRunHostOptions: RunHostChoiceOption[] = buildHeavyRunHostRegistry({
  repos: [],
  settings: null,
  sshTargetLabels: FULL_SSH_CONFIG_TARGET_LABELS,
  runtimeEnvironments: DUPLICATE_PAIRED_SERVER_ENVIRONMENTS,
  runtimeStatusByEnvironmentId: DUPLICATE_PAIRED_SERVER_STATUS,
  localHostLabel: 'Mac'
}).map((host) => ({ hostId: host.id, label: host.label }))

/** A deliberately long list to prove the row never squeezes its label. */
export const stressRunHostOptions: RunHostChoiceOption[] = [
  'Mac',
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
].map((label, index) => ({
  hostId: index === 0 ? 'local' : `runtime:${label}`,
  label,
  disabled: label === 'github.com-client-b'
}))
