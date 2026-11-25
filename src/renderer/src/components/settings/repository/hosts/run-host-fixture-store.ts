import type { AppState } from '@/store/types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import { getProjectIdentityKey } from '../../../../../../shared/project/host-setup/project-host-setup-projection'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import {
  DUPLICATE_PAIRED_SERVER_ENVIRONMENTS,
  DUPLICATE_PAIRED_SERVER_STATUS,
  FULL_SSH_CONFIG_TARGET_LABELS
} from '../../../../../../shared/execution-host/__fixtures__/full-ssh-config-hosts'

const remote = {
  canonicalKey: 'github.com/example/app',
  remoteName: 'origin',
  remoteUrl: 'git@github.com:example/app.git'
}

const repo = (id: string, fields: Partial<Repo>): Repo => ({
  id,
  path: `/work/app-${id}`,
  displayName: 'app',
  badgeColor: '#8b5cf6',
  addedAt: 1,
  gitRemoteIdentity: remote,
  ...fields
})

/** One project checked out here, on the twice-paired server, and on two ssh aliases. */
export const RUN_HOST_FIXTURE_REPO = repo('local', {})

const repos: Repo[] = [
  RUN_HOST_FIXTURE_REPO,
  repo('vps', { executionHostId: 'runtime:env-vps' }),
  repo('vps-ip', { executionHostId: 'runtime:env-vps-ip' }),
  repo('ssh-vps', { connectionId: 'vps', executionHostId: 'ssh:vps' }),
  repo('ssh-client', {
    connectionId: 'github.com-client-a',
    executionHostId: 'ssh:github.com-client-a'
  })
]

/** The app state the real "Run on" rows read: full ssh config, server paired by alias and by IP. */
export function runHostFixtureStore(settings: Partial<GlobalSettings> = {}): Partial<AppState> {
  return {
    repos,
    sshTargetLabels: new Map(FULL_SSH_CONFIG_TARGET_LABELS),
    runtimeEnvironments: DUPLICATE_PAIRED_SERVER_ENVIRONMENTS.map((environment) => ({
      id: environment.id,
      name: environment.name ?? environment.id,
      createdAt: 1,
      updatedAt: 1,
      lastUsedAt: null,
      runtimeId: null,
      endpoints: [],
      preferredEndpointId: environment.id
    })),
    runtimeStatusByEnvironmentId: new Map(DUPLICATE_PAIRED_SERVER_STATUS),
    settings: { ...getDefaultSettings('/home/fixture'), ...settings }
  }
}

export const RUN_HOST_FIXTURE_PROJECT_ID = getProjectIdentityKey(RUN_HOST_FIXTURE_REPO)

/** Opens a SettingsSearchableSelect; the list portals to <body>, which the shot includes. */
export async function openRunHostDropdown(frame: HTMLElement): Promise<void> {
  frame.querySelector<HTMLElement>('[role="combobox"]')?.click()
  await new Promise((resolve) => setTimeout(resolve, 150))
}
