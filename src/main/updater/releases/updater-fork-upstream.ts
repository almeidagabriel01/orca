import { net } from 'electron'
import { compareVersions, isPrereleaseVersion, isValidVersion } from './updater-fallback'
import { FETCH_TIMEOUT_MS, requestReleaseHead } from './updater-release-readiness'
import { resolveReleaseApiToken } from './updater-release-api-token'
import { FORK_RELEASE_REPO, UPSTREAM_RELEASE_REPO } from '../../../shared/updater/fork-release-repo'
import type {
  ForkBuildFailure,
  ForkBuildPending
} from '../../../shared/updater/update-status-types'

// Must match the fork's workflow files, the branch they run from and the sync's issue (docs/fork-releases.md).
const FORK_SYNC_WORKFLOW = 'fork-sync.yml'
const FORK_RELEASE_WORKFLOW = 'fork-release.yml'
const FORK_SYNC_REF = 'fork-main'
const FORK_SYNC_ISSUE_LABEL = 'upstream-sync'
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
  const response = await requestReleaseHead(latestUrl)
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
  // Asked even after a failure: once fork-main is fixed, this run is the one that builds it.
  void requestForkSync(version)
  const failure = await fetchForkBuildFailure(version).catch(() => null)
  return failure ? { version, failure } : { version }
}

type ForkGitHubItem = { title?: unknown; conclusion?: unknown; htmlUrl?: unknown }

function parseForkGitHubItem(value: unknown): ForkGitHubItem | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return {
    title: 'title' in value ? value.title : undefined,
    conclusion: 'conclusion' in value ? value.conclusion : undefined,
    htmlUrl: 'html_url' in value ? value.html_url : undefined
  }
}

/** Where the fork's build of `version` failed: its open sync issue, else the latest failed sync or release run. */
export function findForkBuildFailure(
  repo: string,
  version: string,
  latestRuns: readonly unknown[],
  openSyncIssues: unknown
): ForkBuildFailure | null {
  const title = `Sync com o Orca original falhou: v${version}`
  const issues: unknown[] = Array.isArray(openSyncIssues) ? openSyncIssues : []
  const issue = issues.map(parseForkGitHubItem).find((item) => item?.title === title)
  const run = latestRuns.map(parseForkGitHubItem).find((item) => item?.conclusion === 'failure')
  const failed = issue ?? run
  if (!failed) {
    return null
  }
  const url = failed.htmlUrl
  // Only this fork's pages reach the UI's link.
  return {
    url: typeof url === 'string' && url.startsWith(`https://github.com/${repo}/`) ? url : null
  }
}

async function fetchForkBuildFailure(version: string): Promise<ForkBuildFailure | null> {
  const token = await resolveReleaseApiToken().catch(() => null)
  const api = `https://api.github.com/repos/${FORK_RELEASE_REPO}`
  const getJson = async (path: string): Promise<unknown> => {
    const response = await net.fetch(`${api}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token.token}` } : {})
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    return response.ok ? response.json() : null
  }
  const latestRun = async (workflow: string): Promise<unknown> => {
    const body = await getJson(
      `actions/workflows/${workflow}/runs?branch=${FORK_SYNC_REF}&per_page=1&exclude_pull_requests=true`
    )
    const runs =
      typeof body === 'object' && body !== null && 'workflow_runs' in body
        ? body.workflow_runs
        : undefined
    return Array.isArray(runs) ? runs[0] : undefined
  }
  const [syncRun, releaseRun, issues] = await Promise.all([
    latestRun(FORK_SYNC_WORKFLOW),
    latestRun(FORK_RELEASE_WORKFLOW),
    getJson(`issues?labels=${FORK_SYNC_ISSUE_LABEL}&state=open&per_page=50`)
  ])
  return findForkBuildFailure(FORK_RELEASE_REPO, version, [syncRun, releaseRun], issues)
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
