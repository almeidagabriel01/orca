import { readFile, readlink } from 'node:fs/promises'
import os from 'node:os'
import { runProcess } from '@orca/process-host'
import type {
  SessionProcess,
  SessionProcessTree
} from '../../shared/diagnostics/process-stats-types'
import { readLibprocProcessFilePath } from '../../shared/process-observation/darwin/libproc-addon'
import { parseLinuxProcStat } from './process-cpu-deltas'
import type { ProcRow } from './process-index'
import type { PtyRegistration } from './pty-registry'

// Why: the panel sweeps every 2 s; older rows mean nobody is polling, so sweep once first.
const FRESH_MS = 5_000
const MAX_PROCESSES = 200
const MAX_COMMAND_CHARS = 4_096
// Linux USER_HZ: /proc start times are in 1/100 s ticks.
const LINUX_TICK_MS = 10

type ProcessDetails = Pick<SessionProcess, 'command' | 'cwd' | 'startedAt'>
type SessionRows = { rootPid: number; rows: ProcRow[] }

let latest: { at: number; bySession: Map<string, SessionRows> } | null = null

/** Every snapshot sweep records each session's rows, so a tree read never sweeps the host again. */
export function rememberSessionProcessRows(
  ptyTrees: readonly { pty: PtyRegistration; rows: ProcRow[] }[],
  agentTrees: readonly { pid: number; agentSessionId: string | null; rows: ProcRow[] }[],
  at: number
): void {
  const bySession = new Map<string, SessionRows>()
  for (const { pty, rows } of ptyTrees) {
    if (pty.pid != null) {
      bySession.set(pty.sessionId ?? pty.ptyId, { rootPid: pty.pid, rows })
    }
  }
  // A chat is read by its agent session id; a process several chats share belongs to none.
  for (const { pid, agentSessionId, rows } of agentTrees) {
    if (agentSessionId !== null) {
      bySession.set(agentSessionId, { rootPid: pid, rows })
    }
  }
  latest = { at, bySession }
}

/** One local session's processes with their commands; null when this host runs no such session. */
export async function collectSessionProcessTree(
  sessionId: string,
  sweep: () => Promise<unknown>,
  platform: NodeJS.Platform = os.platform()
): Promise<SessionProcessTree | null> {
  if (!latest || Date.now() - latest.at > FRESH_MS) {
    await sweep()
  }
  const entry = latest?.bySession.get(sessionId)
  if (!entry) {
    return null
  }
  const rows = entry.rows.slice(0, MAX_PROCESSES)
  const details = await readProcessDetails(
    rows.map((row) => row.pid),
    platform
  )
  return {
    sessionId,
    rootPid: entry.rootPid,
    collectedAt: Date.now(),
    processes: rows.map(({ pid, ppid, cpu, memory }) => ({
      pid,
      ppid,
      cpu,
      memory,
      command: null,
      cwd: null,
      startedAt: null,
      ...details.get(pid)
    }))
  }
}

export function readProcessDetails(
  pids: number[],
  platform: NodeJS.Platform
): Promise<Map<number, ProcessDetails>> {
  if (platform === 'linux') {
    return readLinuxDetails(pids)
  }
  if (platform === 'darwin') {
    return readDarwinDetails(pids)
  }
  // ponytail: Windows rows carry no command or folder; CIM CommandLine could add them.
  return Promise.resolve(new Map())
}

export function cmdlineText(raw: string): string | null {
  const text = raw.split('\0').filter(Boolean).join(' ')
  return text ? text.slice(0, MAX_COMMAND_CHARS) : null
}

let linuxBootMs: number | null | undefined

async function readLinuxBootMs(): Promise<number | null> {
  if (linuxBootMs === undefined) {
    const stat = await readFile('/proc/stat', 'utf8').catch(() => '')
    const btime = /^btime (\d+)$/m.exec(stat)?.[1]
    linuxBootMs = btime ? Number(btime) * 1000 : null
  }
  return linuxBootMs
}

async function readLinuxDetails(pids: number[]): Promise<Map<number, ProcessDetails>> {
  const bootMs = await readLinuxBootMs()
  const read = async (pid: number): Promise<[number, ProcessDetails]> => {
    // Unreadable (another user's process, exited): that field stays unknown.
    const [cmdline, cwd, stat] = await Promise.all([
      readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => ''),
      readlink(`/proc/${pid}/cwd`).catch(() => null),
      readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '')
    ])
    const startTicks = Number(parseLinuxProcStat(stat)?.startTimeId)
    return [
      pid,
      {
        command: cmdlineText(cmdline),
        cwd,
        startedAt:
          bootMs !== null && Number.isFinite(startTicks)
            ? bootMs + startTicks * LINUX_TICK_MS
            : null
      }
    ]
  }
  return new Map(await Promise.all(pids.map(read)))
}

/** ps etime: [[dd-]hh:]mm:ss. */
export function parseEtimeSeconds(etime: string): number | null {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(etime)
  if (!match) {
    return null
  }
  const [, days = '0', hours = '0', minutes, seconds] = match
  return ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)
}

export function parseDarwinPsDetails(stdout: string, now: number): Map<number, ProcessDetails> {
  const details = new Map<number, ProcessDetails>()
  for (const line of stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line)
    if (!match) {
      continue
    }
    const elapsed = parseEtimeSeconds(match[2])
    details.set(Number(match[1]), {
      command: match[3].trim().slice(0, MAX_COMMAND_CHARS) || null,
      cwd: null,
      startedAt: elapsed === null ? null : now - elapsed * 1000
    })
  }
  return details
}

// Sweep and session-tree reads queue here so together they hold one of the addon's two path-read slots.
let darwinCwdReads: Promise<void> = Promise.resolve()

async function readDarwinDetails(pids: number[]): Promise<Map<number, ProcessDetails>> {
  // One ps for the whole tree; exits 1 when a pid has gone, and still lists the others.
  const result = await runProcess({
    program: 'ps',
    args: ['-ww', '-o', 'pid=,etime=,args=', '-p', pids.join(',')],
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 2_000
  }).catch(() => null)
  const details = parseDarwinPsDetails(result?.stdout ?? '', Date.now())
  // Why: the addon skips reads past two in flight, so a parallel burst left all but two folders unknown; one read takes µs.
  // ponytail: libproc only; without the addon folders stay unknown rather than one lsof per process every poll.
  const reads = darwinCwdReads.then(async () => {
    for (const [pid, row] of details) {
      row.cwd = (await readLibprocProcessFilePath('cwd', pid).catch(() => null)) || null
    }
  })
  darwinCwdReads = reads
  await reads
  return details
}
