import type { HeavyQueuePeer } from '../../../../../shared/diagnostics/heavy-job-move-types'
import type {
  HeavyCommandJob,
  HeavyJobMovedTo,
  HeavyCommandQueue,
  HeavyCommandWorkspace
} from '../../../../../shared/diagnostics/process-stats-types'
import { finiteNumber, isRecord } from './host-snapshot-value-guards'

const MAX_JOBS = 200
// Why roomy: the row shows and copies the whole command.
const MAX_COMMAND_CHARS = 8_192
const MAX_PATH_CHARS = 1_024
const MAX_NAME_CHARS = 256
const MAX_ARGS = 256
const MAX_PEERS = 16

function boundedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null
}

function parseArgv(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ARGS) {
    return undefined
  }
  // Why all or nothing: a cut argv would run a different command on the other host.
  return value.every((arg) => typeof arg === 'string' && arg.length <= MAX_COMMAND_CHARS)
    ? (value as string[])
    : undefined
}

function parsePeer(value: unknown): HeavyQueuePeer | null {
  if (!isRecord(value)) {
    return null
  }
  const name = boundedString(value.name, MAX_NAME_CHARS)
  const alias = boundedString(value.alias, MAX_NAME_CHARS)
  return name && alias
    ? { name, alias, hostname: boundedString(value.hostname, MAX_NAME_CHARS) }
    : null
}

function parseMovedTo(value: unknown): HeavyJobMovedTo | null {
  const peer = parsePeer(isRecord(value) ? { ...value, name: value.peer } : null)
  return peer ? { peer: peer.name, alias: peer.alias, hostname: peer.hostname } : null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function epochMs(value: unknown): number | null {
  const ms = finiteNumber(value)
  return ms !== null && ms >= 0 ? ms : null
}

function parseWorkspace(value: unknown): HeavyCommandWorkspace | undefined {
  if (
    !isRecord(value) ||
    typeof value.worktreeId !== 'string' ||
    typeof value.worktreeName !== 'string' ||
    typeof value.repoName !== 'string'
  ) {
    return undefined
  }
  return {
    worktreeId: value.worktreeId.slice(0, MAX_PATH_CHARS),
    worktreeName: value.worktreeName.slice(0, MAX_NAME_CHARS),
    repoName: value.repoName.slice(0, MAX_NAME_CHARS)
  }
}

function parseJob(value: unknown): HeavyCommandJob | null {
  if (!isRecord(value)) {
    return null
  }
  const pid = positiveInteger(value.pid)
  const queuedAt = epochMs(value.queuedAt)
  const { status } = value
  if (
    pid === null ||
    queuedAt === null ||
    (status !== 'running' && status !== 'waiting' && status !== 'moved') ||
    typeof value.cwd !== 'string' ||
    typeof value.command !== 'string'
  ) {
    return null
  }
  const running = status === 'running'
  const workspace = parseWorkspace(value.workspace)
  const argv = parseArgv(value.argv)
  const group = boundedString(value.group, MAX_NAME_CHARS)
  const movedFrom = boundedString(value.movedFrom, MAX_NAME_CHARS)
  const movedTo = status === 'moved' ? parseMovedTo(value.movedTo) : null
  return {
    pid,
    status,
    slot: running ? positiveInteger(value.slot) : null,
    position: running ? null : positiveInteger(value.position),
    ordered: !running && value.ordered === true,
    direct: value.direct === true,
    extra: running && value.extra === true,
    queuedAt,
    startedAt: running ? epochMs(value.startedAt) : null,
    cwd: value.cwd.slice(0, MAX_PATH_CHARS),
    command: value.command.slice(0, MAX_COMMAND_CHARS),
    ...(argv ? { argv } : {}),
    ...(group ? { group } : {}),
    ...(movedFrom ? { movedFrom } : {}),
    ...(movedTo ? { movedTo } : {}),
    ...(workspace ? { workspace } : {})
  }
}

// Why capped: a paired server is another machine; malformed or oversized rows must not reach the UI.
/** Null when the host reports no queue, which hides its section. */
export function parseHeavyCommandQueue(value: unknown): HeavyCommandQueue | null {
  if (!isRecord(value) || !Array.isArray(value.jobs)) {
    return null
  }
  const readAt = epochMs(value.readAt)
  const slots = positiveInteger(value.slots)
  if (readAt === null || slots === null) {
    return null
  }
  const hostname = boundedString(value.hostname, MAX_NAME_CHARS)
  return {
    readAt,
    slots,
    controls: value.controls === true,
    canStop: value.canStop === true,
    ...(hostname ? { hostname } : {}),
    ...(value.controls === true && value.canMoveHost === true
      ? {
          canMoveHost: true,
          peers: Array.isArray(value.peers)
            ? value.peers.slice(0, MAX_PEERS).flatMap((peer) => parsePeer(peer) ?? [])
            : []
        }
      : {}),
    jobs: value.jobs.slice(0, MAX_JOBS).flatMap((job) => parseJob(job) ?? [])
  }
}
