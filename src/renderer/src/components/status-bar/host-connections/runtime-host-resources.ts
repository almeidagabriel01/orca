import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import {
  parseExecutionHostId,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type {
  SessionMemory,
  UsageValues,
  WorktreeMemory
} from '../../../../../shared/diagnostics/process-stats-types'
import type { RuntimeHostResourceSample } from '../resources/workspace-attribution/resource-usage-merge-types'

export type UsedOfTotal = { used: number; total: number }

/** Whole-machine numbers; each is null when the host does not report it. */
export type HostMachineTotals = {
  /** Busy share of all cores, 0-100. */
  cpuPercent: number | null
  cpuCores: number | null
  memory: UsedOfTotal | null
  /** total 0 means the host has no swap. */
  swap: UsedOfTotal | null
  disk: UsedOfTotal | null
  /** 1, 5 and 15 minute averages. */
  loadAverage: [number, number, number] | null
}

export type RuntimeHostResourceResult =
  // app is null for servers that predate reporting it: unknown, not idle.
  | {
      status: 'sampled'
      worktrees: WorktreeMemory[]
      app: UsageValues | null
      machine: HostMachineTotals
    }
  // An unanswered server is unverifiable, not idle.
  | { status: 'unreachable' }
  | { status: 'update-required' }

export type RuntimeHostResourceCall = (environmentId: string) => Promise<unknown>

/** Paired servers that host at least one of this client's projects or folder workspaces. */
export function collectRuntimeResourceEnvironmentIds(
  hostIds: Iterable<string | null | undefined>
): string[] {
  const environmentIds = new Set<string>()
  for (const hostId of hostIds) {
    const parsed = parseExecutionHostId(hostId)
    if (parsed?.kind === 'runtime') {
      environmentIds.add(parsed.environmentId)
    }
  }
  return [...environmentIds].sort()
}

export async function readRuntimeHostResources(
  environmentId: string,
  call: RuntimeHostResourceCall
): Promise<RuntimeHostResourceResult> {
  try {
    const snapshot = await call(environmentId)
    const worktrees = parseSnapshotWorktrees(snapshot)
    return worktrees
      ? {
          status: 'sampled',
          worktrees,
          app: parseAppUsage(snapshot),
          machine: parseHostMachineTotals(isRecord(snapshot) ? snapshot.host : null)
        }
      : { status: 'update-required' }
  } catch (error) {
    return hasErrorCode(error, 'method_not_found')
      ? { status: 'update-required' }
      : { status: 'unreachable' }
  }
}

export function toRuntimeHostResourceSamples(
  results: Readonly<Record<string, RuntimeHostResourceResult>>,
  hostLabel: (environmentId: string) => string
): RuntimeHostResourceSample[] {
  const samples: RuntimeHostResourceSample[] = []
  for (const [environmentId, result] of Object.entries(results)) {
    if (result.status === 'sampled') {
      samples.push({
        hostId: toRuntimeExecutionHostId(environmentId),
        hostLabel: hostLabel(environmentId),
        worktrees: result.worktrees
      })
    }
  }
  return samples
}

export function getRuntimeHostResourceNotice(
  result: RuntimeHostResourceResult,
  label: string,
  t: Translate = translate
): string | null {
  if (result.status === 'unreachable') {
    return t(
      'auto.components.status.bar.ResourceUsageStatusSegment.8a0472ab54',
      "Couldn't reach {{value0}}; its resources are unknown.",
      { value0: label }
    )
  }
  if (result.status === 'update-required') {
    return t(
      'auto.components.status.bar.ResourceUsageStatusSegment.1ea066b73f',
      'Update {{value0}} to see its resources.',
      { value0: label }
    )
  }
  return null
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function usedOfTotal(used: unknown, total: unknown, allowEmpty = false): UsedOfTotal | null {
  const u = finiteNumber(used)
  const t = finiteNumber(total)
  if (u === null || t === null || u < 0 || u > t || (allowEmpty ? t < 0 : t <= 0)) {
    return null
  }
  return { used: u, total: t }
}

// Why per field: servers older than a field omit it, and that field alone must read as unknown.
export function parseHostMachineTotals(value: unknown): HostMachineTotals {
  const host = isRecord(value) ? value : {}
  const cpuPercent = finiteNumber(host.cpuUsagePercent)
  const cpuCores = finiteNumber(host.cpuCoreCount)
  const load = Array.isArray(host.loadAverage) ? host.loadAverage.map(finiteNumber) : []
  return {
    cpuPercent: cpuPercent !== null && cpuPercent >= 0 && cpuPercent <= 100 ? cpuPercent : null,
    cpuCores: cpuCores !== null && Number.isInteger(cpuCores) && cpuCores > 0 ? cpuCores : null,
    memory: usedOfTotal(host.usedMemory, host.totalMemory),
    swap: usedOfTotal(host.swapUsed, host.swapTotal, true),
    disk: usedOfTotal(host.diskUsed, host.diskTotal),
    loadAverage: isLoadAverage(load) ? load : null
  }
}

function isLoadAverage(load: (number | null)[]): load is [number, number, number] {
  return load.length === 3 && load.every((n) => n !== null && n >= 0)
}

// Why main must be sampled: older headless servers report only their terminal daemon, an undercount.
function parseAppUsage(value: unknown): UsageValues | null {
  const app = isRecord(value) && isRecord(value.app) ? value.app : null
  const cpu = app ? finiteNumber(app.cpu) : null
  const memory = app ? finiteNumber(app.memory) : null
  const mainMemory = app && isRecord(app.main) ? finiteNumber(app.main.memory) : null
  return cpu === null || memory === null || !mainMemory ? null : { cpu, memory }
}

// Independently updated servers may send mixed shapes; keep valid rows and reject malformed data.
function parseSnapshotWorktrees(value: unknown): WorktreeMemory[] | null {
  if (!isRecord(value) || !Array.isArray(value.worktrees)) {
    return null
  }
  const worktrees: WorktreeMemory[] = []
  for (const row of value.worktrees) {
    const cpu = isRecord(row) ? finiteNumber(row.cpu) : null
    const memory = isRecord(row) ? finiteNumber(row.memory) : null
    if (
      !isRecord(row) ||
      typeof row.worktreeId !== 'string' ||
      typeof row.repoId !== 'string' ||
      cpu === null ||
      memory === null
    ) {
      continue
    }
    worktrees.push({
      worktreeId: row.worktreeId,
      worktreeName: typeof row.worktreeName === 'string' ? row.worktreeName : row.worktreeId,
      repoId: row.repoId,
      repoName: typeof row.repoName === 'string' ? row.repoName : row.repoId,
      cpu,
      memory,
      sessions: Array.isArray(row.sessions) ? row.sessions.flatMap(parseSessionMemory) : [],
      history: Array.isArray(row.history)
        ? row.history.flatMap((sample) => finiteNumber(sample) ?? [])
        : []
    })
  }
  return worktrees
}

function parseSessionMemory(value: unknown): SessionMemory[] {
  if (!isRecord(value) || typeof value.sessionId !== 'string') {
    return []
  }
  const cpu = finiteNumber(value.cpu)
  const memory = finiteNumber(value.memory)
  if (cpu === null || memory === null) {
    return []
  }
  return [
    {
      sessionId: value.sessionId,
      paneKey: typeof value.paneKey === 'string' ? value.paneKey : null,
      pid: finiteNumber(value.pid) ?? 0,
      cpu,
      memory
    }
  ]
}
