import { describe, expect, it, vi } from 'vitest'
import { WslHostAgentAwake } from './wsl-host-agent-awake'

function setup() {
  let onFrame: (frame: unknown) => void = () => {}
  const report = vi.fn()
  const watcher = new WslHostAgentAwake({
    listHosts: () => [{ environmentId: 'env', state: 'ready' }],
    onHostsChanged: () => () => {},
    openStream: async (_id, handlers) => {
      onFrame = handlers.onFrame
      return { close: () => {} }
    },
    report,
    now: () => 1000
  })
  return { watcher, report, send: (frame: unknown) => onFrame(frame) }
}

const chatTab = (state: string) => ({
  id: 'chat-1',
  type: 'agent-session',
  chatStatus: { state, updatedAt: 5, evidenceObservedAt: 7 }
})

describe('WSL keep-awake chat tabs', () => {
  it('counts a working agent-session tab but not an idle one', () => {
    const { watcher, report, send } = setup()
    send({ type: 'snapshots', snapshots: [] })
    report.mockClear()

    send({ type: 'updated', worktree: 'wt', tabs: [chatTab('idle')] })
    expect(report).not.toHaveBeenCalled()

    send({ type: 'updated', worktree: 'wt', tabs: [chatTab('working')] })
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('env', [{ paneKey: 'wt\0chat-1', receivedAt: 1000 }])
    watcher.dispose()
  })
})
