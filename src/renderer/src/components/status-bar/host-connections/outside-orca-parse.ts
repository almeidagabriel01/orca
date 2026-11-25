import type { OutsideOrcaProcessGroup } from '../../../../../shared/diagnostics/process-stats-types'
import { finiteNumber, isRecord } from './host-snapshot-value-guards'

const OUTSIDE_ORCA_KINDS: readonly unknown[] = ['app', 'container', 'command', 'kernel']
function isOutsideOrcaKind(value: unknown): value is OutsideOrcaProcessGroup['kind'] {
  return OUTSIDE_ORCA_KINDS.includes(value)
}
const MAX_OUTSIDE_ORCA_GROUPS = 100
const MAX_OUTSIDE_ORCA_NAME_CHARS = 64
// Ids are dropped, not cut, past this: a cut id names nothing.
const MAX_OUTSIDE_ORCA_TEXT_CHARS = 512

function boundedText(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_OUTSIDE_ORCA_TEXT_CHARS
    ? value
    : undefined
}

function parseWorkspace(value: unknown): OutsideOrcaProcessGroup['workspace'] {
  const worktreeId = isRecord(value) ? boundedText(value.worktreeId) : undefined
  const worktreeName = isRecord(value) ? boundedText(value.worktreeName) : undefined
  const repoName = isRecord(value) ? boundedText(value.repoName) : undefined
  return worktreeId && worktreeName && repoName ? { worktreeId, worktreeName, repoName } : undefined
}

// Why capped: a paired server is another machine; malformed or oversized rows must not reach the UI.
export function parseOutsideOrcaGroups(value: unknown): OutsideOrcaProcessGroup[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const groups: OutsideOrcaProcessGroup[] = []
  for (const row of value.slice(0, MAX_OUTSIDE_ORCA_GROUPS)) {
    if (!isRecord(row)) {
      continue
    }
    const name =
      typeof row.name === 'string' && row.name.length > 0
        ? row.name.slice(0, MAX_OUTSIDE_ORCA_NAME_CHARS)
        : undefined
    const cpu = finiteNumber(row.cpu)
    const memory = finiteNumber(row.memory)
    const processCount = finiteNumber(row.processCount)
    if (
      !name ||
      !isOutsideOrcaKind(row.kind) ||
      cpu === null ||
      cpu < 0 ||
      memory === null ||
      memory < 0 ||
      processCount === null ||
      processCount < 1
    ) {
      continue
    }
    const devices = finiteNumber(row.devices)
    const launcher = boundedText(row.launcher)
    const workspace = parseWorkspace(row.workspace)
    const folder = boundedText(row.folder)
    groups.push({
      name,
      kind: row.kind,
      cpu,
      memory,
      processCount: Math.floor(processCount),
      ...(devices !== null && devices >= 1 ? { devices: Math.floor(devices) } : {}),
      ...(launcher ? { launcher } : {}),
      ...(workspace ? { workspace } : {}),
      ...(folder ? { folder } : {})
    })
  }
  return groups
}
