import { describe, expect, it, vi } from 'vitest'
import { pollHeavyQueues } from './heavy-queue-auto-route-poll'

const queue = { readAt: 1, slots: 1, controls: true, canStop: true, jobs: [] }
const notFound = Object.assign(new Error('method not found'), { code: 'method_not_found' })

describe('pollHeavyQueues', () => {
  it('asks no host without a run-host preference', async () => {
    const read = vi.fn(async (_id: string) => queue)
    for (const settings of [null, {}, { heavyRunHostDefault: null, projectRunHostIds: {} }]) {
      expect(await pollHeavyQueues(settings, ['local', 'env-a'], read, new Set())).toEqual([])
    }
    expect(read).not.toHaveBeenCalled()
  })

  it('asks no host with a single candidate', async () => {
    const read = vi.fn(async (_id: string) => queue)
    const settings = { heavyRunHostDefault: 'local' as const }
    expect(await pollHeavyQueues(settings, ['local'], read, new Set())).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('reads every host once a preference is saved', async () => {
    const read = vi.fn(async (_id: string) => queue)
    const settings = { projectRunHostIds: { p1: 'runtime:env-a' as const } }
    const polled = await pollHeavyQueues(settings, ['local', 'env-a'], read, new Set())
    expect(read.mock.calls.map(([id]) => id)).toEqual(['local', 'env-a'])
    expect(polled.map((host) => host.id)).toEqual(['local', 'env-a'])
  })

  it('stops asking a host that lacks the method, but keeps one that merely failed', async () => {
    const read = vi.fn(async (id: string) => {
      if (id === 'old') {
        throw notFound
      }
      if (id === 'flaky') {
        throw new Error('timeout')
      }
      return queue
    })
    const settings = { heavyRunHostDefault: 'local' as const }
    const unsupported = new Set<string>()
    const hosts = ['local', 'old', 'flaky']
    expect((await pollHeavyQueues(settings, hosts, read, unsupported)).map((h) => h.id)).toEqual([
      'local'
    ])
    read.mockClear()
    await pollHeavyQueues(settings, hosts, read, unsupported)
    expect(read.mock.calls.map(([id]) => id)).toEqual(['local', 'flaky'])
    expect([...unsupported]).toEqual(['old'])
  })
})
