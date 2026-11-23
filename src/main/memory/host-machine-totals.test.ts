import { describe, expect, it } from 'vitest'
import {
  cpuUsagePercentBetween,
  parseDarwinSwapUsage,
  parseLinuxSwap,
  readCpuTimes
} from './host-machine-totals'

const cpu = (busy: number, idle: number) => ({
  model: 'x',
  speed: 1,
  times: { user: busy, nice: 0, sys: 0, irq: 0, idle }
})

describe('host machine totals', () => {
  it('measures busy share across all cores between two samples', () => {
    const before = readCpuTimes([cpu(100, 900), cpu(100, 900)])
    // Core 1 fully busy and core 2 idle for 1s: half the machine.
    const after = readCpuTimes([cpu(1100, 900), cpu(100, 1900)])
    expect(cpuUsagePercentBetween(before, after)).toBe(50)
    expect(cpuUsagePercentBetween(after, after)).toBeNull()
  })

  it('parses swap from /proc/meminfo and sysctl vm.swapusage', () => {
    expect(
      parseLinuxSwap(
        'MemTotal:       16000 kB\nSwapTotal:       4096 kB\nSwapFree:        1024 kB\n'
      )
    ).toEqual({ total: 4096 * 1024, used: 3072 * 1024 })
    expect(parseLinuxSwap('MemTotal:       16000 kB\n')).toBeNull()
    expect(
      parseDarwinSwapUsage('total = 2048.00M  used = 1024.50M  free = 1023.50M  (encrypted)\n')
    ).toEqual({ total: 2048 * 1024 ** 2, used: Math.round(1024.5 * 1024 ** 2) })
    expect(parseDarwinSwapUsage('total = 0.00M  used = 0.00M  free = 0.00M')).toEqual({
      total: 0,
      used: 0
    })
    expect(parseDarwinSwapUsage('')).toBeNull()
  })
})
