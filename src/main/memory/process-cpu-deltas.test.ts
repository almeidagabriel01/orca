import { describe, expect, it } from 'vitest'
import { applyCpuTimeDeltas, parseLinuxProcStat } from './process-cpu-deltas'

const LINUX_TICKS_PER_MS = 0.1

describe('CPU from time used between samples', () => {
  it('reads utime + stime and start time even when comm holds spaces and parentheses', () => {
    const stat =
      '4242 (Web (Content) x) S 1 4242 4242 0 -1 4194560 100 0 0 0 150 50 0 0 20 0 3 0 987654 1000 200 18446744073709551615'
    expect(parseLinuxProcStat(stat)).toEqual({ cpuTicks: 200n, startTimeId: '987654' })
    expect(parseLinuxProcStat('garbage')).toBeNull()
  })

  it('reports current use, not the lifetime average, and never inherits a reused pid', () => {
    const times = (ticks: bigint, start = 'a') => ({ cpuTicks: ticks, startTimeId: start })
    const rows = [
      { pid: 1, cpu: 0 },
      { pid: 2, cpu: 0 },
      { pid: 3, cpu: 0 }
    ]
    const first = {
      sampledAtMs: 0,
      cpuByPid: new Map([
        [1, times(10_000n)],
        [2, times(500n)],
        [3, times(0n)]
      ])
    }
    expect(applyCpuTimeDeltas(rows, first, null, LINUX_TICKS_PER_MS)).toBe(first)
    expect(rows.map((row) => row.cpu)).toEqual([0, 0, 0])

    // 2 s later: pid 1 used 1 s (50% of a core), pid 2 was idle, pid 3 is a new process.
    const second = {
      sampledAtMs: 2_000,
      cpuByPid: new Map([
        [1, times(10_100n)],
        [2, times(500n)],
        [3, times(400n, 'b')]
      ])
    }
    expect(applyCpuTimeDeltas(rows, second, first, LINUX_TICKS_PER_MS)).toBe(second)
    expect(rows.map((row) => row.cpu)).toEqual([50, 0, 0])
  })
})
