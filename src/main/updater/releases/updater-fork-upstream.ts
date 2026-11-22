import { net } from 'electron'
import { compareVersions, isPrereleaseVersion, isValidVersion } from './updater-fallback'
import { FETCH_TIMEOUT_MS, requestGitHubReleaseHead } from './updater-release-readiness'
import { resolveReleaseApiToken } from './updater-release-api-token'
import { FORK_RELEASE_REPO, UPSTREAM_RELEASE_REPO } from '../../../shared/updater/fork-release-repo'
import type { ForkBuildPending } from '../../../shared/updater/update-status-types'

// Must match the fork's sync workflow file and the branch it runs from (docs/fork-releases.md).
const FORK_SYNC_WORKFLOW = 'fork-sync.yml'
const FORK_SYNC_REF = 'fork-main'
let syncRequestedFor: string | null = null

/** Squirrel.Mac installs only Developer ID builds, so the fork's self-signed Mac build is downloaded by hand. */
export function isForkManualDownload(): boolean {
  return FORK_RELEASE_REPO !== '' && process.platform === 'darwin'
}

export function getForkReleasePageUrl(version: string): string {
  return `https://github.com/${FORK_RELEASE_REPO}/releases/tag/v${encodeURIComponent(version)}`
}

async function fetchUpstreamLatestVersion(): Promise<string | null> {
  const latestUrl = `https://github.com/${UPSTREAM_RELEASE_REPO}/releases/latest`
  const response = await requestGitHubReleaseHead(latestUrl)
  if (!response?.redirectUrl) {
    return null
  }
  const tag = new URL(response.redirectUrl, latestUrl).pathname.match(
    /\/releases\/tag\/([^/]+)$/
  )?.[1]
  const version = tag ? decodeURIComponent(tag).replace(/^v/i, '') : null
  return version && isValidVersion(version) && !isPrereleaseVersion(version) ? version : null
}

/** Fork builds learn of new versions from upstream but install only the fork's build of them. */
export async function fetchForkBuildPending(
  currentVersion: string,
  newerForkTags: readonly string[]
): Promise<ForkBuildPending | null> {
  if (!FORK_RELEASE_REPO || newerForkTags.length > 0) {
    return null
  }
  const version = await fetchUpstreamLatestVersion().catch(() => null)
  if (!version || compareVersions(version, currentVersion) <= 0) {
    return null
  }
  void requestForkSync(version)
  return { version }
}

// Best effort: the hourly schedule syncs anyway; a signed-in gh only shortens the wait.
async function requestForkSync(version: string): Promise<void> {
  if (syncRequestedFor === version) {
    return
  }
  syncRequestedFor = version
  const token = await resolveReleaseApiToken().catch(() => null)
  if (!token) {
    return
  }
  const url = `https://api.github.com/repos/${FORK_RELEASE_REPO}/actions/workflows/${FORK_SYNC_WORKFLOW}/dispatches`
  await net
    .fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: FORK_SYNC_REF }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    .catch(() => undefined)
}
