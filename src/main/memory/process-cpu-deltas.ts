import os from 'node:os'

export type ProcessCpuTimes = {
  cpuTicks: bigint
  /** Changes when a pid is reused, so a new process never inherits the old one's baseline. */
  startTimeId: string
}

export type ProcessCpuSample = {
  sampledAtMs: number
  cpuByPid: ReadonlyMap<number, ProcessCpuTimes>
}

const CPU_MIN_SAMPLE_MS = 250
const CPU_STALE_AFTER_MS = 10_000

/** Sets each row's CPU (percent of one core) from the time it used since the previous sample and returns the next baseline; rows without one keep their CPU. */
export function applyCpuTimeDeltas(
  rows: readonly { pid: number; cpu: number }[],
  sample: ProcessCpuSample,
  previous: ProcessCpuSample | null,
  ticksPerMs: number
): ProcessCpuSample {
  if (!previous) {
    return sample
  }
  const elapsedMs = sample.sampledAtMs - previous.sampledAtMs
  if (elapsedMs < CPU_MIN_SAMPLE_MS) {
    // Preserve the baseline when samples are too close for stable CPU rates.
    return previous
  }
  if (elapsedMs > CPU_STALE_AFTER_MS) {
    // Long gaps after sleep/closed dashboards produce stale averages; discard them.
    return sample
  }
  const maxProcessCpu = Math.max(1, os.cpus().length) * 100
  for (const row of rows) {
    const current = sample.cpuByPid.get(row.pid)
    const before = previous.cpuByPid.get(row.pid)
    if (
      !current ||
      !before ||
      current.startTimeId !== before.startTimeId ||
      current.cpuTicks < before.cpuTicks
    ) {
      continue
    }
    const cpuMs = Number(current.cpuTicks - before.cpuTicks) / ticksPerMs
    const cpu = (cpuMs / elapsedMs) * 100
    row.cpu = Number.isFinite(cpu) ? Math.min(maxProcessCpu, Math.max(0, cpu)) : 0
  }
  return sample
}

/** utime + stime and start time from /proc/<pid>/stat; comm may hold spaces and parentheses. */
export function parseLinuxProcStat(stat: string): ProcessCpuTimes | null {
  const end = stat.lastIndexOf(')')
  if (end === -1) {
    return null
  }
  // fields[0] is field 3 (state): utime is field 14, stime 15, starttime 22.
  const fields = stat.slice(end + 2).split(' ')
  const [utime, stime, start] = [fields[11], fields[12], fields[19]]
  return [utime, stime, start].every((field) => /^\d+$/.test(field ?? ''))
    ? { cpuTicks: BigInt(utime) + BigInt(stime), startTimeId: start }
    : null
}
