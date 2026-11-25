import type { OutsideQueueProcessGroup } from '../../../../../shared/diagnostics/process-stats-types'
import { finiteNumber, isRecord } from './host-snapshot-value-guards'

function outsideQueueKind(value: unknown): OutsideQueueProcessGroup['kind'] | null {
  return value === 'app' || value === 'container' || value === 'command' ? value : null
}
const MAX_OUTSIDE_QUEUE_GROUPS = 12
const MAX_OUTSIDE_QUEUE_TEXT_CHARS = 128

function boundedText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, MAX_OUTSIDE_QUEUE_TEXT_CHARS)
    : undefined
}

export function parseOutsideQueueGroups(value: unknown): OutsideQueueProcessGroup[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const groups: OutsideQueueProcessGroup[] = []
  for (const row of value.slice(0, MAX_OUTSIDE_QUEUE_GROUPS)) {
    if (!isRecord(row)) {
      continue
    }
    const cpu = finiteNumber(row.cpu)
    const memory = finiteNumber(row.memory)
    const count = finiteNumber(row.count)
    const name = boundedText(row.name)
    const kind = outsideQueueKind(row.kind)
    if (
      !name ||
      !kind ||
      cpu === null ||
      cpu < 0 ||
      memory === null ||
      memory < 0 ||
      count === null ||
      count < 1
    ) {
      continue
    }
    const ws = isRecord(row.workspace) ? row.workspace : null
    const worktreeId = ws ? boundedText(ws.worktreeId) : undefined
    const worktreeName = ws ? boundedText(ws.worktreeName) : undefined
    const repoName = ws ? boundedText(ws.repoName) : undefined
    const launcher = boundedText(row.launcher)
    const folder = boundedText(row.folder)
    groups.push({
      name,
      kind,
      cpu,
      memory,
      count: Math.floor(count),
      ...(launcher ? { launcher } : {}),
      ...(worktreeId && worktreeName && repoName
        ? { workspace: { worktreeId, worktreeName, repoName } }
        : {}),
      ...(folder ? { folder } : {})
    })
  }
  return groups
}
