import type {
  HeavyCommandJob,
  HeavyCommandQueue,
  HeavyCommandWorkspace
} from '../../../../../shared/diagnostics/process-stats-types'
import { finiteNumber, isRecord } from './host-snapshot-value-guards'

const MAX_JOBS = 200
// Why roomy: the row shows and copies the whole command.
const MAX_COMMAND_CHARS = 8_192
const MAX_PATH_CHARS = 1_024
const MAX_NAME_CHARS = 256

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
    (status !== 'running' && status !== 'waiting') ||
    typeof value.cwd !== 'string' ||
    typeof value.command !== 'string'
  ) {
    return null
  }
  const running = status === 'running'
  const workspace = parseWorkspace(value.workspace)
  return {
    pid,
    status,
    slot: running ? positiveInteger(value.slot) : null,
    position: running ? null : positiveInteger(value.position),
    direct: value.direct === true,
    extra: running && value.extra === true,
    queuedAt,
    startedAt: running ? epochMs(value.startedAt) : null,
    cwd: value.cwd.slice(0, MAX_PATH_CHARS),
    command: value.command.slice(0, MAX_COMMAND_CHARS),
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
  return {
    readAt,
    slots,
    controls: value.controls === true,
    jobs: value.jobs.slice(0, MAX_JOBS).flatMap((job) => parseJob(job) ?? [])
  }
}
