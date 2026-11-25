import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import type { Translate } from '@/i18n/use-translate'
import type {
  HeavyJobMoveBlocker,
  HeavyJobMoveBlockerCode,
  HeavyJobMoveSource,
  HeavyJobTargetCheck,
  HeavyJobTargetRequest,
  HeavyQueuePeer
} from '../../../../../../shared/diagnostics/heavy-job-move-types'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import { hasErrorCode } from '../../host-connections/runtime-host-resources'
import { callHeavyQueueAction } from './resource-heavy-queue-actions'

const SOURCE_TIMEOUT_MS = 15_000
// Why longer: prepare fetches and fast-forwards the target checkout.
const TARGET_TIMEOUT_MS = 60_000

/** A host card with a queue that can move jobs; id is 'local' or the paired environment id. */
export type HeavyMoveHost = { id: string; label: string; queue: HeavyCommandQueue }

/** Other machines only: one per hostname, and never the source's own machine paired twice. */
export function heavyMoveTargets(
  sourceId: string,
  hosts: readonly HeavyMoveHost[]
): HeavyMoveHost[] {
  const sourceHostname = hosts.find((host) => host.id === sourceId)?.queue.hostname
  const seen = new Set<string>()
  return hosts.filter((host) => {
    const hostname = host.queue.hostname
    if (host.id === sourceId || (hostname && hostname === sourceHostname)) {
      return false
    }
    if (!hostname) {
      return true
    }
    if (seen.has(hostname)) {
      return false
    }
    seen.add(hostname)
    return true
  })
}

export type HeavyJobMovePlan = { peer: HeavyQueuePeer; request: HeavyJobTargetRequest }

export type HeavyJobMoveCheckResult =
  | { ok: true; plan: HeavyJobMovePlan }
  | { ok: false; blockers: HeavyJobMoveBlocker[] }

const blocked = (code: HeavyJobMoveBlockerCode, detail?: string): HeavyJobMoveCheckResult => ({
  ok: false,
  blockers: [detail ? { code, detail } : { code }]
})

/** The source's ssh peer that reaches the target, matched by the hostname the target reports. */
export function findMovePeer(
  source: HeavyCommandQueue,
  targetHostname: string | null | undefined
): HeavyQueuePeer | null {
  if (!targetHostname) {
    return null
  }
  return source.peers?.find((peer) => peer.hostname === targetHostname) ?? null
}

/** Blockers known from the sample alone, so no host is asked about them. */
export function sampleMoveBlockers(job: HeavyCommandJob): HeavyJobMoveBlocker[] {
  if (job.status === 'moved' || job.movedFrom) {
    return [{ code: 'already_moved' }]
  }
  return job.argv ? [] : [{ code: 'no_argv' }]
}

function failureBlocker(error: unknown): HeavyJobMoveBlocker {
  if (hasErrorCode(error, 'method_not_found')) {
    return { code: 'unsupported_host' }
  }
  const message = extractIpcErrorMessage(error, '')
  if (message.includes('heavy_queue_unavailable')) {
    return { code: 'queue_unavailable' }
  }
  return message ? { code: 'host_unreachable', detail: message } : { code: 'host_unreachable' }
}

function readBlockers(value: unknown): HeavyJobMoveBlocker[] {
  return Array.isArray(value)
    ? value.flatMap((row) =>
        row && typeof row === 'object' && typeof row.code === 'string'
          ? [
              typeof row.detail === 'string'
                ? { code: row.code, detail: row.detail.slice(0, 512) }
                : { code: row.code }
            ]
          : []
      )
    : []
}

function callMoveSource(hostId: string, pid: number): Promise<HeavyJobMoveSource> {
  return hostId === 'local'
    ? window.api.memory.heavyJobMoveSource(pid, { resourceManagerView: true })
    : callRuntimeRpc<HeavyJobMoveSource>(
        { kind: 'environment', environmentId: hostId },
        'diagnostics.heavyJobMoveSource',
        { pid },
        { timeoutMs: SOURCE_TIMEOUT_MS }
      )
}

function callTargetCheck(
  hostId: string,
  request: HeavyJobTargetRequest
): Promise<HeavyJobTargetCheck> {
  return hostId === 'local'
    ? window.api.memory.heavyJobTargetCheck(request, { resourceManagerView: true })
    : callRuntimeRpc<HeavyJobTargetCheck>(
        { kind: 'environment', environmentId: hostId },
        'diagnostics.heavyJobTargetCheck',
        request,
        { timeoutMs: TARGET_TIMEOUT_MS }
      )
}

async function askTarget(
  target: HeavyMoveHost,
  request: HeavyJobTargetRequest
): Promise<HeavyJobMoveBlocker[] | string> {
  try {
    const check = await callTargetCheck(target.id, request)
    const blockers = readBlockers(check?.blockers)
    if (blockers.length > 0) {
      return blockers
    }
    return typeof check?.cwd === 'string' && check.cwd.startsWith('/')
      ? check.cwd
      : [{ code: 'directory_missing' }]
  } catch (error) {
    return [failureBlocker(error)]
  }
}

/** Asks the source about the job and the target whether it can run it; nothing changes. */
export async function checkHeavyJobMove(
  source: HeavyMoveHost,
  target: HeavyMoveHost,
  job: HeavyCommandJob
): Promise<HeavyJobMoveCheckResult> {
  const known = sampleMoveBlockers(job)
  if (known.length > 0) {
    return { ok: false, blockers: known }
  }
  if (!source.queue.canMoveHost || !target.queue.canMoveHost) {
    return blocked('queue_unavailable')
  }
  const peer = findMovePeer(source.queue, target.queue.hostname)
  if (!peer) {
    return blocked('no_peer')
  }
  let found: HeavyJobMoveSource
  try {
    found = await callMoveSource(source.id, job.pid)
  } catch (error) {
    return { ok: false, blockers: [failureBlocker(error)] }
  }
  const sourceBlockers = readBlockers(found?.blockers)
  if (sourceBlockers.length > 0) {
    return { ok: false, blockers: sourceBlockers }
  }
  const { remoteUrl, branch, commit, relativeDir, argv } = found
  if (!remoteUrl || !branch || !commit || relativeDir === null || !argv?.length) {
    return blocked(argv?.length ? 'not_git' : 'no_argv')
  }
  const request = { remoteUrl, branch, commit, relativeDir, argv, prepare: false }
  const answer = await askTarget(target, request)
  return typeof answer === 'string'
    ? { ok: true, plan: { peer, request } }
    : { ok: false, blockers: answer }
}

/** Prepares the target, then has the source's wrapper hand the job over. Blockers when the target refused. */
export async function executeHeavyJobMove(
  source: HeavyMoveHost,
  target: HeavyMoveHost,
  pid: number,
  plan: HeavyJobMovePlan
): Promise<HeavyJobMoveBlocker[]> {
  const answer = await askTarget(target, { ...plan.request, prepare: true })
  if (typeof answer !== 'string') {
    return answer
  }
  await callHeavyQueueAction(source.id, {
    action: 'move-host',
    pid,
    peer: plan.peer.alias,
    cwd: answer
  })
  return []
}

export function heavyJobBlockerText(blocker: HeavyJobMoveBlocker, t: Translate): string {
  const value0 = blocker.detail ?? ''
  const texts: Record<HeavyJobMoveBlockerCode, () => string> = {
    queue_unavailable: () =>
      t(
        'resourceManager.heavyQueue.blocker.queueUnavailable',
        "That host's heavy queue can't move jobs; update it"
      ),
    job_gone: () => t('resourceManager.heavyQueue.blocker.jobGone', 'The job already ended'),
    no_argv: () =>
      t(
        'resourceManager.heavyQueue.blocker.noArgv',
        'Started by an older heavy queue that did not record the command'
      ),
    already_moved: () => t('resourceManager.heavyQueue.blocker.alreadyMoved', 'Already moved once'),
    not_git: () =>
      t('resourceManager.heavyQueue.blocker.notGit', 'The folder is not a git checkout'),
    no_remote: () => t('resourceManager.heavyQueue.blocker.noRemote', 'The checkout has no remote'),
    detached_head: () =>
      t('resourceManager.heavyQueue.blocker.detachedHead', 'The checkout is not on a branch'),
    uncommitted_changes: () =>
      t('resourceManager.heavyQueue.blocker.uncommittedChanges', 'Uncommitted changes here'),
    unpushed_commits: () =>
      t('resourceManager.heavyQueue.blocker.unpushedCommits', 'Commits here are not pushed'),
    no_peer: () =>
      t(
        'resourceManager.heavyQueue.blocker.noPeer',
        'No ssh peer reaches that host; add it to the heavy peers'
      ),
    project_missing: () =>
      t('resourceManager.heavyQueue.blocker.projectMissing', 'The project is not cloned there'),
    no_checkout_on_branch: () =>
      t(
        'resourceManager.heavyQueue.blocker.noCheckoutOnBranch',
        'No checkout on branch {{value0}} there',
        { value0 }
      ),
    commit_unreachable: () =>
      t(
        'resourceManager.heavyQueue.blocker.commitUnreachable',
        "That host can't fetch this commit"
      ),
    checkout_dirty: () =>
      t(
        'resourceManager.heavyQueue.blocker.checkoutDirty',
        'The checkout there is behind and has local changes'
      ),
    checkout_diverged: () =>
      t(
        'resourceManager.heavyQueue.blocker.checkoutDiverged',
        'The checkout there has commits this one lacks'
      ),
    directory_missing: () =>
      t(
        'resourceManager.heavyQueue.blocker.directoryMissing',
        'Folder {{value0}} is missing there',
        { value0 }
      ),
    executable_missing: () =>
      t(
        'resourceManager.heavyQueue.blocker.executableMissing',
        '{{value0}} is not installed there',
        { value0 }
      ),
    script_missing: () =>
      t('resourceManager.heavyQueue.blocker.scriptMissing', 'Script {{value0}} is missing there', {
        value0
      }),
    docker_unavailable: () =>
      t('resourceManager.heavyQueue.blocker.dockerUnavailable', 'Docker is not running there'),
    host_unreachable: () =>
      t('resourceManager.heavyQueue.blocker.hostUnreachable', "Couldn't reach the host"),
    unsupported_host: () =>
      t(
        'resourceManager.heavyQueue.blocker.unsupportedHost',
        'That host runs an older Orca; update it'
      )
  }
  const text = (texts[blocker.code] ?? texts.host_unreachable)()
  // Why: codes whose sentence has no slot still keep their subject visible.
  const slotted = [
    'no_checkout_on_branch',
    'directory_missing',
    'executable_missing',
    'script_missing'
  ]
  return blocker.detail && !slotted.includes(blocker.code) ? `${text} (${blocker.detail})` : text
}

export function heavyJobBlockersText(
  blockers: readonly HeavyJobMoveBlocker[],
  t: Translate
): string {
  return blockers.map((blocker) => heavyJobBlockerText(blocker, t)).join(' · ')
}
