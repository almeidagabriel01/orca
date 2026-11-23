import { runProcess } from '@orca/process-host'
import { statfs } from 'node:fs/promises'
import os from 'node:os'
import type { HostMemory } from '../../shared/diagnostics/process-stats-types'

type CpuTimes = { idle: number; total: number }
type UsedOfTotal = { used: number; total: number }
export type HostMachineTotals = Pick<
  HostMemory,
  'cpuUsagePercent' | 'swapTotal' | 'swapUsed' | 'diskTotal' | 'diskUsed' | 'loadAverage'
>

// Why: shorter windows are noise, and several callers may sample the same host back to back.
const MIN_CPU_WINDOW_MS = 500
const SLOW_SAMPLE_TTL_MS = 30_000
const SLOW_SAMPLE_TIMEOUT_MS = 1_000
const KIB = 1024
const UNIT_BYTES: Record<string, number> = { K: KIB, M: KIB ** 2, G: KIB ** 3, T: KIB ** 4 }

let previousCpuTimes: CpuTimes | null = null
let lastCpuUsagePercent: number | undefined

export function readCpuTimes(cpus: readonly os.CpuInfo[] = os.cpus()): CpuTimes {
  let idle = 0
  let total = 0
  for (const { times } of cpus) {
    idle += times.idle
    total += times.user + times.nice + times.sys + times.irq + times.idle
  }
  return { idle, total }
}

/** Busy share of all cores between two samples, 0-100; null when no time elapsed. */
export function cpuUsagePercentBetween(previous: CpuTimes, next: CpuTimes): number | null {
  const total = next.total - previous.total
  if (!(total > 0)) {
    return null
  }
  const busy = 1 - (next.idle - previous.idle) / total
  return Math.min(100, Math.max(0, busy * 100))
}

function sampleCpuUsagePercent(): number | undefined {
  const cpus = os.cpus()
  const next = readCpuTimes(cpus)
  // Why: the first sample has no window; since-boot averages would read as current load.
  if (!previousCpuTimes || next.total < previousCpuTimes.total) {
    previousCpuTimes = next
    return undefined
  }
  if (next.total - previousCpuTimes.total < MIN_CPU_WINDOW_MS * Math.max(1, cpus.length)) {
    return lastCpuUsagePercent
  }
  lastCpuUsagePercent = cpuUsagePercentBetween(previousCpuTimes, next) ?? undefined
  previousCpuTimes = next
  return lastCpuUsagePercent
}

export function parseLinuxSwap(meminfo: string): UsedOfTotal | null {
  const total = readMeminfoBytes(meminfo, 'SwapTotal')
  const free = readMeminfoBytes(meminfo, 'SwapFree')
  return total === null || free === null ? null : { total, used: Math.max(0, total - free) }
}

/** Parses `sysctl -n vm.swapusage`, e.g. "total = 2048.00M  used = 1024.50M  free = 1023.50M". */
export function parseDarwinSwapUsage(stdout: string): UsedOfTotal | null {
  const total = readSysctlBytes(stdout, 'total')
  const used = readSysctlBytes(stdout, 'used')
  return total === null || used === null ? null : { total, used: Math.min(total, used) }
}

function readMeminfoBytes(meminfo: string, key: string): number | null {
  const kib = Number(new RegExp(`^${key}:\\s*(\\d+)\\s+kB$`, 'm').exec(meminfo)?.[1])
  return Number.isSafeInteger(kib) && kib >= 0 ? kib * KIB : null
}

function readSysctlBytes(stdout: string, key: string): number | null {
  const match = new RegExp(`${key} = ([\\d.]+)([KMGT])`).exec(stdout)
  const value = Number(match?.[1])
  return match && Number.isFinite(value) && value >= 0
    ? Math.round(value * UNIT_BYTES[match[2]])
    : null
}

/**
 * Re-reads at most once per TTL, never overlaps a pending read, and never waits past the timeout.
 * A timed-out wait yields null, or with keepLastOnTimeout the last settled value.
 */
export function createSlowSample<T>(
  read: () => Promise<T | null>,
  { ttlMs = SLOW_SAMPLE_TTL_MS, keepLastOnTimeout = false } = {}
): (() => Promise<T | null>) & { invalidate: () => void } {
  let sample: { at: number; settled: boolean; value: Promise<T | null> } | null = null
  let last: T | null = null
  const readSample = (): Promise<T | null> => {
    const now = Date.now()
    if (!sample || (sample.settled && now - sample.at >= ttlMs)) {
      const next = { at: now, settled: false, value: read().catch(() => null) }
      void next.value.then((value) => {
        next.settled = true
        last = value
      })
      sample = next
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<T | null>((resolve) => {
      timer = setTimeout(() => resolve(keepLastOnTimeout ? last : null), SLOW_SAMPLE_TIMEOUT_MS)
    })
    return Promise.race([sample.value, timeout]).finally(() => clearTimeout(timer))
  }
  // A settled sample is dropped so the next call reads again; a pending one is already fresh.
  const invalidate = (): void => {
    if (sample?.settled) {
      sample = null
    }
  }
  return Object.assign(readSample, { invalidate })
}

// Why home: it is the volume holding the user's projects; on macOS that is the Data volume.
const sampleHomeDisk = createSlowSample<UsedOfTotal>(async () => {
  const stats = await statfs(os.homedir())
  const total = stats.blocks * stats.bsize
  // Why bavail: reserved blocks are not usable, so count them as used, like Finder and df's Use%.
  const used = Math.max(0, total - stats.bavail * stats.bsize)
  return Number.isFinite(total) && total > 0 ? { total, used } : null
})

// Why cached: Node has no swap API on macOS; sysctl runs at most once per TTL.
const sampleDarwinSwap = createSlowSample<UsedOfTotal>(async () => {
  const result = await runProcess({
    program: '/usr/sbin/sysctl',
    args: ['-n', 'vm.swapusage'],
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    maxOutputBytes: 4 * KIB,
    timeoutMs: SLOW_SAMPLE_TIMEOUT_MS
  })
  return result.code === 0 && !result.timedOut ? parseDarwinSwapUsage(result.stdout) : null
})

/** Whole-machine totals; omitted fields are unknown, never zero. */
export async function collectHostMachineTotals(
  platform: NodeJS.Platform,
  meminfo: string | null
): Promise<HostMachineTotals> {
  const [disk, darwinSwap] = await Promise.all([
    sampleHomeDisk(),
    platform === 'darwin' ? sampleDarwinSwap() : null
  ])
  const swap = platform === 'linux' && meminfo !== null ? parseLinuxSwap(meminfo) : darwinSwap
  const cpuUsagePercent = sampleCpuUsagePercent()
  const [load1, load5, load15] = os.loadavg()
  return {
    ...(cpuUsagePercent === undefined ? {} : { cpuUsagePercent }),
    ...(swap ? { swapTotal: swap.total, swapUsed: swap.used } : {}),
    ...(disk ? { diskTotal: disk.total, diskUsed: disk.used } : {}),
    // Why: Windows has no load average; os.loadavg() reports zeros there.
    ...(platform === 'win32' ? {} : { loadAverage: [load1, load5, load15] })
  }
}
