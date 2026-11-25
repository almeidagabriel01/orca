import { describe, expect, it } from 'vitest'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import { buildHeavyQueueView, cwdName } from './resource-heavy-queue-view'

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

  it('offers only the moves the order allows, and none without controls', () => {
    const jobs = [
      job(1, { position: 1, ordered: true }),
      job(2, { position: 2, ordered: true }),
      job(3, { direct: true, queuedAt: 5 })
    ]
    const can = buildHeavyQueueView({ readAt: 0, slots: 1, controls: true, jobs }).waiting.map(
      (row) => row.can
    )
    expect(can[0]).toMatchObject({ runNext: false, moveUp: false, moveDown: true, startNow: true })
    expect(can[1]).toMatchObject({ runNext: true, moveUp: true, moveDown: false, moveToEnd: false })
    expect(can[2]).toEqual({
      runNext: false,
      moveUp: false,
      moveDown: false,
      moveToEnd: false,
      startNow: false,
      remove: true,
      stop: false
    })

    const readOnly = buildHeavyQueueView({ readAt: 0, slots: 1, controls: false, jobs })
    expect(readOnly.waiting.every((row) => Object.values(row.can).every((v) => !v))).toBe(true)
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
