import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import {
  parseExecutionHostId,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type {
  ChatAgentMemory,
  HeavyCommandQueue,
  OutsideOrcaProcessGroup,
  SessionMemory,
  UsageValues,
  WorktreeMemory
} from '../../../../../shared/diagnostics/process-stats-types'
import type { RuntimeHostResourceSample } from '../resources/workspace-attribution/resource-usage-merge-types'
import { parseHeavyCommandQueue } from './heavy-command-queue-parse'
import { parseOutsideOrcaGroups } from './outside-orca-parse'
import { finiteNumber, isRecord } from './host-snapshot-value-guards'

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
  /** What runs outside Orca; null when the host does not report it. */
  outsideOrca: OutsideOrcaProcessGroup[] | null
  /** Heavy groups the queue did not start; null when the host does not report them. */
  outsideQueue?: OutsideOrcaProcessGroup[] | null
  /** The host's vps-heavy queue; null when it has none. */
  heavyQueue: HeavyCommandQueue | null
}

export type RuntimeHostResourceResult =
  // app is null for servers that predate reporting it: unknown, not idle.
  | {
      status: 'sampled'
      worktrees: WorktreeMemory[]
      app: UsageValues | null
      machine: HostMachineTotals
      /** False for a host that predates sending chats: its chat workers are missing, not absent. */
      chatsIncluded: boolean
    }
  // An unanswered server is unverifiable, not idle.
  | { status: 'unreachable' }
  | { status: 'update-required' }

export type RuntimeHostResourceCall = (environmentId: string) => Promise<unknown>

export type RuntimeHostResourceState = {
  key: string | null
  results: Readonly<Record<string, RuntimeHostResourceResult>>
}

/** The state after one host's answer; a repeated failure keeps the same state so nothing re-renders. */
export function withRuntimeHostResult(
  prev: RuntimeHostResourceState,
  key: string,
  environmentId: string,
  result: RuntimeHostResourceResult
): RuntimeHostResourceState {
  const results = prev.key === key ? prev.results : {}
  const before = results[environmentId]
  if (before && before.status !== 'sampled' && before.status === result.status) {
    return prev
  }
  return { key, results: { ...results, [environmentId]: result } }
}

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

/** Null when the reply arrives after the asking view stopped wanting it, so it is never parsed. */
export async function readRuntimeHostResources(
  environmentId: string,
  call: RuntimeHostResourceCall,
  isWanted: () => boolean = () => true
): Promise<RuntimeHostResourceResult | null> {
  try {
    const snapshot = await call(environmentId)
    if (!isWanted()) {
      return null
    }
    const worktrees = parseSnapshotWorktrees(snapshot)
    return worktrees
      ? {
          status: 'sampled',
          worktrees,
          app: parseAppUsage(snapshot),
          machine: parseHostMachineTotals(isRecord(snapshot) ? snapshot.host : null),
          chatsIncluded: isRecord(snapshot) && snapshot.chatsIncluded === true
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
  if (!result.chatsIncluded) {
    return t('resourceManager.hostChatsUpdateRequired', 'Update {{value0}} to see its chats.', {
      value0: label
    })
  }
  return null
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
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
    loadAverage: isLoadAverage(load) ? load : null,
    outsideOrca: parseOutsideOrcaGroups(host.outsideOrca),
    outsideQueue: parseOutsideOrcaGroups(host.outsideQueue),
    heavyQueue: parseHeavyCommandQueue(host.heavyQueue)
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
    const chats = Array.isArray(row.chats) ? parseChats(row.chats) : []
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
        : [],
      ...(chats.length > 0 ? { chats } : {})
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

const MAX_CHATS_PER_WORKSPACE = 200
const MAX_CHAT_TEXT_CHARS = 256

// Why capped: a paired server is another machine; malformed or oversized chats must not reach the UI.
function parseChats(value: readonly unknown[]): ChatAgentMemory[] {
  const chats: ChatAgentMemory[] = []
  for (const chat of value.slice(0, MAX_CHATS_PER_WORKSPACE)) {
    const cpu = isRecord(chat) ? finiteNumber(chat.cpu) : null
    const memory = isRecord(chat) ? finiteNumber(chat.memory) : null
    if (
      isRecord(chat) &&
      typeof chat.agentSessionId === 'string' &&
      chat.agentSessionId.length > 0 &&
      typeof chat.agent === 'string' &&
      (chat.name === null || typeof chat.name === 'string') &&
      cpu !== null &&
      cpu >= 0 &&
      memory !== null &&
      memory >= 0
    ) {
      chats.push({
        agentSessionId: chat.agentSessionId.slice(0, MAX_CHAT_TEXT_CHARS),
        agent: chat.agent.slice(0, MAX_CHAT_TEXT_CHARS),
        name: chat.name === null ? null : chat.name.slice(0, MAX_CHAT_TEXT_CHARS),
        cpu,
        memory
      })
    }
  }
  return chats
}
