import { runProcess } from '@orca/process-host'
import {
  windowsPowerShellPath,
  windowsSystem32Binary
} from '@orca/process-host/windows-system-binary'
import { performance } from 'node:perf_hooks'
import {
  parseTypeperfProcessOutput,
  parseWindowsProcessSample,
  TYPEPERF_COUNTERS,
  type ParsedWindowsProcessSample,
  type WindowsProcessResourceRow
} from './windows-process-sample-parsing'
import { applyCpuTimeDeltas, type ProcessCpuSample } from './process-cpu-deltas'

export type { WindowsProcessResourceRow } from './windows-process-sample-parsing'

const PROCESS_QUERY_TIMEOUT_MS = 5_000
const PROCESS_QUERY_MAX_BUFFER = 10 * 1024 * 1024
const HUNDRED_NS_TICKS_PER_MS = 10_000
const CIM_RETRY_AFTER_MS = 30_000

type WindowsProcessSample = ParsedWindowsProcessSample & {
  sampledAtMs: number
}

let processBackend: 'cim' | 'typeperf' = 'cim'
let previousCpuSample: ProcessCpuSample | null = null
let retryCimAtMs = 0

/** `trackCpu: false` leaves the resource view's CPU baseline untouched and reports no CPU. */
export async function enumerateWindowsProcessResources({
  trackCpu = true,
  withNames = false
}: { trackCpu?: boolean; withNames?: boolean } = {}): Promise<WindowsProcessResourceRow[]> {
  // Reuse one CIM sweep for resources and identity instead of spawning PowerShell twice per poll.
  if (processBackend === 'typeperf') {
    if (performance.now() < retryCimAtMs) {
      return enumerateWindowsWithTypeperf(withNames)
    }
    processBackend = 'cim'
  }

  const sample = await enumerateWindowsWithCim(withNames)
  if (sample) {
    return trackCpu ? applyWindowsCpuSample(sample) : sample.rows
  }
  // Back off blocked CIM queries while allowing recovery from transient failures.
  processBackend = 'typeperf'
  retryCimAtMs = performance.now() + CIM_RETRY_AFTER_MS
  if (trackCpu) {
    previousCpuSample = null
  }
  return enumerateWindowsWithTypeperf(withNames)
}

function applyWindowsCpuSample(sample: WindowsProcessSample): WindowsProcessResourceRow[] {
  previousCpuSample = applyCpuTimeDeltas(
    sample.rows,
    sample,
    previousCpuSample,
    HUNDRED_NS_TICKS_PER_MS
  )
  return sample.rows
}

async function enumerateWindowsWithCim(withNames: boolean): Promise<WindowsProcessSample | null> {
  // PageFileUsage includes committed memory hidden by working-set trimming.
  const nameProperty = withNames ? ',Name' : ''
  const nameField = withNames ? ', $_.Name' : ''
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; " +
      `Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime,CreationDate,PageFileUsage${nameProperty} | ` +
      `ForEach-Object { try { [string]::Join([char]9, @($_.ProcessId, $_.ParentProcessId, $_.WorkingSetSize, [string]$_.KernelModeTime, [string]$_.UserModeTime, $_.CreationDate.ToUniversalTime().Ticks, $_.PageFileUsage${nameField})) } catch {} }`
  ]
  try {
    const stdout = await execFileText(windowsPowerShellPath(), args)
    const parsed = parseWindowsProcessSample(stdout)
    return parsed.rows.length > 0 ? { ...parsed, sampledAtMs: performance.now() } : null
  } catch (err) {
    console.warn('[memory] PowerShell process enumeration failed; falling back to typeperf', err)
    return null
  }
}

async function enumerateWindowsWithTypeperf(
  withNames: boolean
): Promise<WindowsProcessResourceRow[]> {
  try {
    // Immediate fallback fits the two-second poll budget without inventing CPU rates.
    const stdout = await execFileText(windowsSystem32Binary('typeperf.exe'), [
      ...TYPEPERF_COUNTERS,
      '-sc',
      '1',
      '-si',
      '0'
    ])
    return parseTypeperfProcessOutput(stdout, withNames)
  } catch (err) {
    console.warn('[memory] typeperf process enumeration failed', err)
    return []
  }
}

async function execFileText(file: string, args: string[]): Promise<string> {
  const result = await runProcess({
    program: file,
    args,
    timeoutMs: PROCESS_QUERY_TIMEOUT_MS,
    maxOutputBytes: PROCESS_QUERY_MAX_BUFFER
  })
  if (result.timedOut || result.code !== 0) {
    throw new Error(`${file} exited ${result.code ?? 'on timeout'}`)
  }
  return result.stdout
}
