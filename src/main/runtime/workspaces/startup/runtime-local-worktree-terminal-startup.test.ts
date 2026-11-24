import { describe, expect, it, vi } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  startRuntimeLocalWorktreeTerminals,
  type RuntimeLocalWorktreeTerminalPorts
} from './runtime-local-worktree-terminal-startup'

function create(emptySurfaceSkipsShell?: boolean) {
  const createTerminal = vi.fn<RuntimeLocalWorktreeTerminalPorts['createTerminal']>(async () => ({
    handle: 'term_1'
  }))
  const ports: RuntimeLocalWorktreeTerminalPorts = {
    canSpawn: true,
    createTerminal,
    pasteDraft: vi.fn(),
    sendFollowup: vi.fn(),
    provision: vi.fn(async () => ({ setupSpawned: false, setupTerminalHandle: null })),
    activate: vi.fn()
  }
  const worktree = { id: 'repo::/w', path: '/w' } as Pick<Worktree, 'id' | 'path'>
  return {
    createTerminal,
    run: () =>
      startRuntimeLocalWorktreeTerminals({
        request: {},
        repo: { id: 'repo' },
        // oxlint-disable-next-line typescript/consistent-type-assertions -- only id and path are read on this path.
        worktree: worktree as Worktree,
        ...(emptySurfaceSkipsShell ? { emptySurfaceSkipsShell } : {}),
        ports
      })
  }
}

describe('a plain workspace create on a host', () => {
  it('seeds the first shell by default', async () => {
    const host = create()
    await host.run()
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
  })

  it('seeds none when the host chose another empty-workspace surface', async () => {
    const host = create(true)
    await host.run()
    expect(host.createTerminal).not.toHaveBeenCalled()
  })
})
