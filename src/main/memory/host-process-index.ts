import { readFile, readlink } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { runProcess } from '@orca/process-host'
import { enumerateWindowsProcessResources } from './windows-process-resource-collector'
import { getProcessMemoryMetric } from './process-memory-metric'
import { readDarwinProcessFootprints } from './darwin-process-footprint'
import {
  applyCpuTimeDeltas,
  parseLinuxProcStat,
  type ProcessCpuSample,
  type ProcessCpuTimes
} from './process-cpu-deltas'
import {
  buildProcessIndex,
  executableBasename,
  parsePsOutput,
  type ProcIndex,
  type ProcRow
} from './process-index'

const PS_EXEC_TIMEOUT_MS = 5_000
const PS_MAX_BUFFER = 10 * 1024 * 1024

/** One whole-host sweep with per-process memory; spawns ps or PowerShell, so callers bound the rate. */
export async function enumerateHostProcesses(
  options: { trackCpu?: boolean; withNames?: boolean; withCommands?: boolean } = {}
): Promise<ProcIndex> {
  const platform = os.platform()
  const withNames = options.withNames ?? false
  const trackCpu = options.trackCpu ?? true
  const [rows, footprints] = await Promise.all([
    platform === 'win32'
      ? enumerateWindowsProcessResources({ trackCpu, withNames })
      : enumerateUnix(platform, withNames, options.withCommands ?? false),
    platform === 'darwin' ? readDarwinProcessFootprints() : Promise.resolve(null)
  ])
  if (platform === 'linux' && trackCpu) {
    await applyLinuxCpuSample(rows)
  }
  return buildProcessIndex(rows, footprints, getProcessMemoryMetric(platform))
}

// comm= is retitlable (macOS argv[0], Linux PR_SET_NAME) and can hold secrets. macOS ucomm= is
// the kernel name; Linux has no such column, so readExecutableNames reads /proc/<pid>/exe instead.
const PS_NAME_COLUMN: Partial<Record<NodeJS.Platform, string>> = { darwin: 'ucomm=' }

// Shown only as folded group names (app bundle, container, command). The default cgroup width cuts container ids.
const PS_COMMAND_COLUMNS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'comm=',
  linux: 'cgroup:512=,comm='
}
const PS_BASE_COLUMNS = 'pid=,ppid=,pcpu=,rss='
let commandColumnsSupported = true

async function enumerateUnix(
  platform: NodeJS.Platform,
  withNames: boolean,
  withCommands: boolean
): Promise<ProcRow[]> {
  const commandColumns =
    withCommands && commandColumnsSupported ? PS_COMMAND_COLUMNS[platform] : undefined
  if (commandColumns) {
    const rows = await readPs(`${PS_BASE_COLUMNS},${commandColumns}`, 'command')
    if (rows) {
      return rows
    }
  }
  const nameColumn = withNames ? PS_NAME_COLUMN[platform] : undefined
  const rows = await readPs(
    nameColumn ? `${PS_BASE_COLUMNS},${nameColumn}` : PS_BASE_COLUMNS,
    nameColumn ? 'name' : undefined
  )
  // Why: BusyBox and old procps lack these columns; a failed extended sweep must not blank Orca's rows.
  if (rows && commandColumns) {
    commandColumnsSupported = false
  }
  return rows ?? []
}

async function readPs(columns: string, trailing?: 'name' | 'command'): Promise<ProcRow[] | null> {
  // Force dot decimals: parseFloat silently truncates locale-formatted comma values.
  try {
    const result = await runProcess({
      program: 'ps',
      args: ['-eo', columns],
      maxOutputBytes: PS_MAX_BUFFER,
      timeoutMs: PS_EXEC_TIMEOUT_MS,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' }
    })
    if (result.timedOut || result.outputTruncated || result.code !== 0) {
      throw new Error(`ps exited ${result.code ?? 'on timeout'}`)
    }
    return parsePsOutput(result.stdout, trailing)
  } catch (err) {
    console.warn('[memory] ps enumeration failed', err)
    return null
  }
}

// Linux USER_HZ: /proc reports CPU time in 1/100 s ticks.
const LINUX_TICKS_PER_MS = 0.1
let previousLinuxCpuSample: ProcessCpuSample | null = null

/** Linux ps pcpu is a lifetime average; replace it with use since the previous sweep (0 on the first). */
async function applyLinuxCpuSample(rows: ProcRow[]): Promise<void> {
  const stats = await withTimeout(
    Promise.all(
      rows.map((row) =>
        readFile(`/proc/${row.pid}/stat`, 'utf8').then(
          (stat) => [row.pid, parseLinuxProcStat(stat)] as const,
          () => [row.pid, null] as const
        )
      )
    ),
    READLINK_TIMEOUT_MS
  )
  const cpuByPid = new Map<number, ProcessCpuTimes>()
  for (const [pid, times] of stats ?? []) {
    if (times) {
      cpuByPid.set(pid, times)
    }
  }
  if (cpuByPid.size === 0) {
    // No readable /proc: keep ps's figure rather than report every process idle.
    return
  }
  for (const row of rows) {
    row.cpu = 0
  }
  previousLinuxCpuSample = applyCpuTimeDeltas(
    rows,
    { sampledAtMs: performance.now(), cpuByPid },
    previousLinuxCpuSample,
    LINUX_TICKS_PER_MS
  )
}

const READLINK_TIMEOUT_MS = 1_000

// A wedged /proc read must not hold the crash sampler's single in-flight slot forever.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    timer.unref?.()
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      }
    )
  })
}

/** Fill names a sweep could not read safely (Linux) from each executable's own file name. */
export async function readExecutableNames(
  rows: readonly ProcRow[],
  platform: NodeJS.Platform = os.platform()
): Promise<void> {
  if (platform !== 'linux') {
    return
  }
  await Promise.all(
    rows.map(async (row) => {
      // Unreadable (another user's process, exited): leave the name unknown.
      const target = await withTimeout(readlink(`/proc/${row.pid}/exe`), READLINK_TIMEOUT_MS)
      const name = executableBasename(target?.replace(/ \(deleted\)$/, ''))
      if (name) {
        row.name = name
      }
    })
  )
}
