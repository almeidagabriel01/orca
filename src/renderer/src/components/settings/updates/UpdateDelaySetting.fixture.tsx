import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { UpdateStatus } from '../../../../../shared/updater/update-status-types'
import { GeneralUpdateSettingsSection } from './GeneralUpdateSettingsSection'
import type { RemoteServerUpdateEntry } from '@/runtime/hosts/updates/remote-server-update-coordinator'

const DAY_MS = 24 * 60 * 60 * 1000

function heldStatus(delayDays: number, releasedDaysAgo: number): UpdateStatus {
  const releasedAt = Date.now() - releasedDaysAgo * DAY_MS
  return {
    state: 'not-available',
    userInitiated: true,
    delayedUpdate: {
      version: '1.4.247',
      releasedAt: new Date(releasedAt).toISOString(),
      availableAt: new Date(releasedAt + delayDays * DAY_MS).toISOString(),
      delayDays
    }
  }
}

function settingsWithDelay(updateDelayDays: number) {
  return { ...getDefaultSettings('/home/fixture'), updateDelayDays }
}

export const off = defineFixture({
  width: 640,
  store: { settings: settingsWithDelay(0), updateStatus: { state: 'not-available' } },
  render: () => <GeneralUpdateSettingsSection />
})

export const infoTooltip = defineFixture({
  ...off,
  interact: (frame) => {
    frame.querySelector<HTMLButtonElement>('button[aria-label="About update delay"]')?.focus()
  }
})

export const heldRelease = defineFixture({
  width: 640,
  store: { settings: settingsWithDelay(7), updateStatus: heldStatus(7, 2) },
  render: () => <GeneralUpdateSettingsSection />
})

export const nearlyCleared = defineFixture({
  width: 640,
  store: { settings: settingsWithDelay(3), updateStatus: heldStatus(3, 2.8) },
  render: () => <GeneralUpdateSettingsSection />
})

export const narrow = defineFixture({
  width: 420,
  store: { settings: settingsWithDelay(14), updateStatus: heldStatus(14, 4) },
  render: () => <GeneralUpdateSettingsSection />
})

export const cleared = defineFixture({
  width: 640,
  store: { settings: settingsWithDelay(3), updateStatus: heldStatus(3, 3.5) },
  render: () => <GeneralUpdateSettingsSection />
})

const server: RemoteServerUpdateEntry = {
  environmentId: 'vps',
  name: 'vps',
  phase: 'current',
  currentVersion: '1.4.272',
  targetVersion: null,
  progress: null,
  runtimeId: null,
  liveTabCount: 0,
  liveLeafCount: 0,
  support: null,
  error: null
}
const FORK_BUILD_STATUS: UpdateStatus = {
  state: 'available',
  version: '1.4.273-fork.1',
  changelog: null,
  manualDownload: true
}
const forkBuildStore = {
  settings: settingsWithDelay(0),
  updateStatus: FORK_BUILD_STATUS,
  remoteServerUpdates: new Map([[server.environmentId, server]])
}

/** Version on the left; Check for updates sits right beside the Download button. */
export const forkBuildWide = defineFixture({
  width: 760,
  store: forkBuildStore,
  render: () => <GeneralUpdateSettingsSection />
})

/** Narrow: both buttons wrap together under the version. */
export const forkBuildNarrow = defineFixture({
  width: 340,
  store: forkBuildStore,
  render: () => <GeneralUpdateSettingsSection />
})
