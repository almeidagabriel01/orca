import { describe, expect, it } from 'vitest'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import { buildHeavyQueueView, cwdName, heavyQueueMoveSteps } from './resource-heavy-queue-view'

const job = (pid: number, fields: Partial<HeavyCommandJob>): HeavyCommandJob => ({
  pid,
  status: 'waiting',
  slot: null,
  position: null,
  ordered: false,
  direct: false,
  extra: false,
  queuedAt: 0,
  startedAt: null,
  cwd: '/home/dev/app',
  command: 'pnpm test',
  ...fields
})

describe('buildHeavyQueueView', () => {
  it('orders the queue as it will run and measures time on the host clock', () => {
    const view = buildHeavyQueueView({
      readAt: 100_000,
      slots: 2,
      controls: true,
      jobs: [
        job(1, { status: 'waiting', position: 2, ordered: true, queuedAt: 10_000 }),
        job(2, { status: 'running', extra: true, queuedAt: 50_000, startedAt: 90_000 }),
        job(3, { status: 'waiting', direct: true, queuedAt: 1_000 }),
        job(4, { status: 'running', slot: 2, queuedAt: 5_000, startedAt: 40_000 }),
        job(5, { status: 'running', slot: 1, direct: true, queuedAt: 30_000 }),
        job(6, {
          status: 'waiting',
          position: 1,
          ordered: true,
          queuedAt: 20_000,
          workspace: { worktreeId: 'w', worktreeName: 'fix', repoName: 'app' }
        })
      ]
    })

    expect(view.running.map((row) => [row.job.pid, row.elapsedMs, row.elapsedFromQueue])).toEqual([
      [5, 70_000, true],
      [4, 60_000, false],
      [2, 10_000, false]
    ])
    expect([view.busy, view.extra]).toEqual([2, 1])
    expect(
      view.waiting.map((row) => [row.job.pid, row.position, row.elapsedMs, row.place])
    ).toEqual([
      [6, 1, 80_000, 'app · fix'],
      [1, 2, 90_000, 'app'],
      [3, 3, 99_000, 'app']
    ])
  })

  it('names agent worktrees and CI runners by their layout, else by the last two folders', () => {
    expect(
      [
        '/home/dev/projects/shop/.claude/worktrees/agent-ad5a/web',
        '/home/gh-runner/actions-runner-3/_work/Org/shop',
        '/home/gh-runner/actions-runner/_work/Org/shop',
        '/private/tmp/rel-1370/repo',
        '/'
      ].map(cwdName)
    ).toEqual([
      'shop · agent-ad5a/web',
      'shop · actions-runner-3',
      'shop · actions-runner',
      'rel-1370 · repo',
      '/'
    ])
  })

  it('offers Stop on running jobs only when the host can stop them', () => {
    const jobs = [job(1, { status: 'running', slot: 1 }), job(2, { position: 1, ordered: true })]
    const view = (canStop: boolean | undefined, controls = true) =>
      buildHeavyQueueView({ readAt: 0, slots: 1, controls, canStop, jobs })
    expect(view(true).running[0].can.stop).toBe(true)
    expect(view(true).waiting[0].can.stop).toBe(false)
    expect(view(undefined).running[0].can.stop).toBe(false)
    expect(view(true, false).running[0].can.stop).toBe(false)
  })
})

describe('heavyQueueMoveSteps', () => {
  // The script's op_move: pop the job, insert it at up i-1, down i+1, top 0, bottom end.
  const apply = (order: number[], pid: number, to: string): number[] => {
    const rest = order.filter((p) => p !== pid)
    const i = order.indexOf(pid)
    const at = { up: Math.max(i - 1, 0), down: i + 1, top: 0, bottom: rest.length }[to] ?? -1
    rest.splice(at, 0, pid)
    return rest
  }

  it('lands every job exactly where it was dropped', () => {
    for (let count = 1; count <= 5; count++) {
      for (let from = 0; from < count; from++) {
        for (let to = 0; to < count; to++) {
          const order = Array.from({ length: count }, (_, i) => i)
          const moved = heavyQueueMoveSteps(from, to).reduce(
            (current, step) => apply(current, from, step),
            order
          )
          const expected = order.filter((p) => p !== from)
          expected.splice(to, 0, from)
          expect(moved).toEqual(expected)
          expect(heavyQueueMoveSteps(from, to).length).toBeLessThanOrEqual(Math.abs(to - from))
        }
      }
    }
  })
})
