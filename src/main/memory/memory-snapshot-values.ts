import type {
  MemorySnapshot,
  ProcessCommitMetric,
  UsageValues
} from '../../shared/diagnostics/process-stats-types'
import { fallbackHostMemory } from './host-memory'
import type { ProcRow } from './process-index'
import { getProcessMemoryMetric } from './process-memory-metric'

const PROCESS_COMMIT_METRIC: ProcessCommitMetric = 'private-bytes'

export function clampMemoryMetric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, value)
}

/** Omit unmeasured commit values; zero must mean measured zero. */
export function optionalCommitField(
  hasPrivateMemory: boolean,
  privateMemory: number
): { privateMemory?: number } {
  return hasPrivateMemory ? { privateMemory: clampMemoryMetric(privateMemory) } : {}
}

export function snapshotCommitFields(
  hasPrivateMemory: boolean,
  totalPrivateMemory: number
): Pick<MemorySnapshot, 'processCommitMetric' | 'totalPrivateMemory'> {
  return hasPrivateMemory
    ? {
        processCommitMetric: PROCESS_COMMIT_METRIC,
        totalPrivateMemory: clampMemoryMetric(totalPrivateMemory)
      }
    : {}
}

export function emptyMemorySnapshot(): MemorySnapshot {
  const zero = { cpu: 0, memory: 0 }
  return {
    app: { ...zero, main: zero, renderer: zero, other: zero, history: [] },
    worktrees: [],
    host: fallbackHostMemory(),
    processMemoryMetric: getProcessMemoryMetric(),
    totalCpu: 0,
    totalMemory: 0,
    collectedAt: Date.now()
  }
}

export type RowTotals = { cpu: number; memory: number; privateMemory: number }

export function sumRows(rows: readonly ProcRow[]): RowTotals {
  const totals = { cpu: 0, memory: 0, privateMemory: 0 }
  for (const row of rows) {
    totals.cpu += row.cpu
    totals.memory += row.memory
    totals.privateMemory += clampMemoryMetric(row.privateMemory)
  }
  return totals
}

export function usageOf(totals: RowTotals, hasPrivateMemory: boolean): UsageValues {
  return {
    cpu: clampMemoryMetric(totals.cpu),
    memory: clampMemoryMetric(totals.memory),
    ...optionalCommitField(hasPrivateMemory, totals.privateMemory)
  }
}

export function addUsage(target: RowTotals, usage: UsageValues): void {
  target.cpu += usage.cpu
  target.memory += usage.memory
  target.privateMemory += clampMemoryMetric(usage.privateMemory)
}
