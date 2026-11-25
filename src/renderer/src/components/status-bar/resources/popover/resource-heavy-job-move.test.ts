import { describe, expect, it, vi } from 'vitest'
import { translate } from '@/i18n/i18n'
import type {
  HeavyCommandJob,
  HeavyCommandQueue
} from '../../../../../../shared/diagnostics/process-stats-types'
import { parseHeavyCommandQueue } from '../../host-connections/heavy-command-queue-parse'
import {
  findMovePeer,
  heavyJobBlockerText,
  type HeavyJobMovePlan,
  type HeavyMoveHost
} from './resource-heavy-job-move'
import { heavyJobRouteKey, pickHeavyJobRoutes, runHeavyJobRoute } from './resource-heavy-job-route'

const job = (pid: number, fields: Partial<HeavyCommandJob> = {}): HeavyCommandJob => ({
  pid,
  status: 'waiting',
  slot: null,
  position: 1,
  ordered: true,
  direct: false,
  extra: false,
  queuedAt: 1000 + pid,
  startedAt: null,
  cwd: '/w',
  command: 'pnpm test',
  argv: ['pnpm', 'test'],
  ...fields
})

const queue = (
  jobs: HeavyCommandJob[],
  fields: Partial<HeavyCommandQueue> = {}
): HeavyCommandQueue => ({
  readAt: 0,
  slots: 1,
  controls: true,
  canMoveHost: true,
  jobs,
  ...fields
})

const host = (id: string, jobs: HeavyCommandJob[], fields: Partial<HeavyCommandQueue> = {}) =>
  ({ id, label: id.toUpperCase(), queue: queue(jobs, fields) }) satisfies HeavyMoveHost

describe('heavy job move', () => {
  it('picks the source peer whose verified hostname is the target', () => {
    const source = queue([], {
      peers: [
        { name: 'old', alias: 'old', hostname: null },
        { name: 'mac', alias: 'mac', hostname: 'gabriel-mac' }
      ]
    })
    expect(findMovePeer(source, 'gabriel-mac')?.alias).toBe('mac')
    expect(findMovePeer(source, 'other')).toBeNull()
    expect(findMovePeer(source, null)).toBeNull()
  })

  it('says what blocks a move, with its subject', () => {
    expect(
      heavyJobBlockerText({ code: 'executable_missing', detail: 'xcodebuild' }, translate)
    ).toBe('xcodebuild is not installed there')
    expect(heavyJobBlockerText({ code: 'unpushed_commits', detail: 'main' }, translate)).toBe(
      'Commits here are not pushed (main)'
    )
  })

  it('parses moved jobs and peers from a paired host, dropping a partial argv', () => {
    const parsed = parseHeavyCommandQueue({
      readAt: 1,
      slots: 1,
      controls: true,
      canMoveHost: true,
      hostname: 'vps',
      peers: [{ name: 'mac', alias: 'mac', hostname: 'gabriel-mac' }, { name: 'bad' }],
      jobs: [
        {
          pid: 7,
          status: 'moved',
          queuedAt: 1,
          cwd: '/w',
          command: 'x',
          argv: ['x', 2],
          movedTo: { peer: 'mac', alias: 'mac', hostname: null }
        }
      ]
    })
    expect(parsed?.peers).toEqual([{ name: 'mac', alias: 'mac', hostname: 'gabriel-mac' }])
    expect(parsed?.jobs[0]).toMatchObject({
      status: 'moved',
      movedTo: { peer: 'mac', alias: 'mac' }
    })
    expect(parsed?.jobs[0].argv).toBeUndefined()
  })
})

describe('heavy job auto-route', () => {
  const toB = () => 'b'

  it('routes only waiting jobs that were not moved, not tried, toward a sampled other host', () => {
    const a = host('a', [
      job(1),
      job(2, { status: 'running', position: null }),
      job(3, { status: 'moved' }),
      job(4, { movedFrom: 'mac' }),
      job(5)
    ])
    const b = host('b', [job(9)])
    const tried = new Set([heavyJobRouteKey('a', a.queue.jobs[4])])
    expect(pickHeavyJobRoutes([a, b], tried, toB).map((route) => route.job.pid)).toEqual([1])
  })

  it('skips jobs without a preference and waits for the preferred host to be sampled', () => {
    const a = host('a', [job(1)])
    expect(pickHeavyJobRoutes([a, host('b', [])], new Set(), () => null)).toEqual([])
    expect(pickHeavyJobRoutes([a], new Set(), toB)).toEqual([])
  })

  const plan: HeavyJobMovePlan = {
    peer: { name: 'b', alias: 'b', hostname: 'b' },
    request: {
      remoteUrl: 'u',
      branch: 'main',
      commit: 'c',
      relativeDir: '',
      argv: ['x'],
      prepare: false
    }
  }

  it('moves when the check passes, once', async () => {
    const [route] = pickHeavyJobRoutes([host('a', [job(1)]), host('b', [])], new Set(), toB)
    const execute = vi.fn().mockResolvedValue([])
    const note = vi.fn()
    const tried = new Set<string>()
    const io = {
      check: async () => ({ ok: true as const, plan }),
      execute,
      note,
      errorText: String
    }
    await runHeavyJobRoute(route, tried, io)
    await runHeavyJobRoute(route, tried, io)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][2]).toBe(1)
    expect(note).not.toHaveBeenCalled()
  })

  it('keeps the job and records why when the preferred host cannot run it', async () => {
    const [route] = pickHeavyJobRoutes([host('a', [job(1)]), host('b', [])], new Set(), toB)
    const execute = vi.fn()
    const note = vi.fn()
    const blockers = [{ code: 'executable_missing' as const, detail: 'xcodebuild' }]
    await runHeavyJobRoute(route, new Set(), {
      check: async () => ({ ok: false as const, blockers }),
      execute,
      note,
      errorText: String
    })
    expect(execute).not.toHaveBeenCalled()
    expect(note).toHaveBeenCalledWith(route.key, { targetLabel: 'B', blockers })
  })
})
