import type { UsedOfTotal } from '../../host-connections/runtime-host-resources'
import type { Metric } from '../workspace-attribution/resource-usage-merge-types'

export type MeterTone = 'normal' | 'warning' | 'critical'

/** Past these shares a machine meter turns amber, then red; below them it stays neutral. */
export const WARNING_PERCENT = 80
export const CRITICAL_PERCENT = 90

/** A process or workspace past either mark is flagged in the lists. */
export const HEAVY_CPU_PERCENT = 50
export const HEAVY_MEMORY_BYTES = 2 * 1024 ** 3

export function percentTone(percent: number | null): MeterTone {
  if (percent === null) {
    return 'normal'
  }
  return percent >= CRITICAL_PERCENT
    ? 'critical'
    : percent >= WARNING_PERCENT
      ? 'warning'
      : 'normal'
}

export function usedPercent(pair: UsedOfTotal | null): number | null {
  return pair && pair.total > 0 ? (pair.used / pair.total) * 100 : null
}

/** The 1-minute load as a share of the cores, so 8.0 on 8 cores reads as full. */
export function loadPercent(
  loadAverage: readonly [number, number, number] | null,
  cores: number | null
): number | null {
  return loadAverage && cores && cores > 0 ? (loadAverage[0] / cores) * 100 : null
}

const GIB = 1024 ** 3

export function formatUsedOfTotal({ used, total }: UsedOfTotal): string {
  const [unit, label] =
    total >= 1024 * GIB ? [1024 * GIB, 'TB'] : total >= GIB ? [GIB, 'GB'] : [1024 ** 2, 'MB']
  const digits = total / unit >= 100 ? 0 : 1
  return `${(used / unit).toFixed(digits)}/${(total / unit).toFixed(digits)} ${label}`
}

export function isHeavyCpu(cpu: Metric): boolean {
  return cpu !== null && cpu >= HEAVY_CPU_PERCENT
}

export function isHeavyMemory(memory: Metric): boolean {
  return memory !== null && memory >= HEAVY_MEMORY_BYTES
}
