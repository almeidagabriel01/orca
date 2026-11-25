import type { HeavyQueuePeer } from '../../shared/diagnostics/heavy-job-move-types'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../shared/diagnostics/process-stats-types'

// Bounds for fields read from a script that may run on another machine.
const MAX_ARGV = 256
const MAX_ARG_CHARS = 8192
const MAX_NAME_CHARS = 256
const MAX_PEERS = 32

type JobMoveFields = Pick<HeavyCommandJob, 'argv' | 'group' | 'movedFrom' | 'movedTo'>
type QueueMoveFields = Pick<HeavyCommandQueue, 'hostname' | 'peers' | 'canMoveHost'>

function boundedName(value: unknown): string | null {
  return typeof value === 'string' && value && value.length <= MAX_NAME_CHARS ? value : null
}

function isArgv(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_ARGV &&
    value.every((arg) => typeof arg === 'string' && arg.length <= MAX_ARG_CHARS)
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A peer as `peers` rows ({name}) and `movedTo` ({peer}) name it. */
function parsePeer(value: unknown, nameKey: 'name' | 'peer'): HeavyQueuePeer | null {
  if (!isObject(value)) {
    return null
  }
  const row = value
  const name = boundedName(row[nameKey])
  const alias = boundedName(row.alias)
  return name && alias ? { name, alias, hostname: boundedName(row.hostname) } : null
}

/** A job row's move-host fields; older scripts write none, and each is left absent then. */
export function parseHeavyJobMoveFields(row: Record<string, unknown>): JobMoveFields {
  const movedTo = row.status === 'moved' ? parsePeer(row.movedTo, 'peer') : null
  return {
    ...(isArgv(row.argv) ? { argv: row.argv } : {}),
    ...('group' in row ? { group: boundedName(row.group) } : {}),
    ...('movedFrom' in row ? { movedFrom: boundedName(row.movedFrom) } : {}),
    ...(row.status === 'moved'
      ? {
          movedTo: movedTo && {
            peer: movedTo.name,
            alias: movedTo.alias,
            hostname: movedTo.hostname
          }
        }
      : {})
  }
}

/** The listing's hostname, and its peers when the script can move jobs to them. */
export function parseHeavyQueueMoveFields(listing: Record<string, unknown>): QueueMoveFields {
  const canMoveHost = Array.isArray(listing.features) && listing.features.includes('move-host')
  return {
    ...('hostname' in listing ? { hostname: boundedName(listing.hostname) } : {}),
    ...(canMoveHost && {
      canMoveHost,
      peers: Array.isArray(listing.peers)
        ? listing.peers.slice(0, MAX_PEERS).flatMap((peer) => parsePeer(peer, 'name') ?? [])
        : []
    })
  }
}
