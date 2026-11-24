import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn<() => Promise<boolean>>(),
  userSurface: vi.fn<(createShell: () => void) => boolean>()
}))

vi.mock('../../../store/index', () => ({
  useAppStore: {
    getState: () => ({
      tabsByWorktree: {},
      pendingWorktreeCreations: {},
      reconcileWorktreeTabModel: () => ({ renderableTabCount: 0 })
    })
  }
}))
vi.mock('./web-runtime-initial-terminal-bootstrap-dispatch', () => ({
  dispatchWebRuntimeInitialTerminalBootstrap: () => mocks.dispatch()
}))
vi.mock('@/lib/workspace/activation/initial-surface/remote-empty-workspace-surface', () => ({
  openRemoteEmptyWorkspaceUserSurface: (_id: string, createShell: () => void) =>
    mocks.userSurface(createShell)
}))
vi.mock(
  '@/lib/workspace/activation/initial-surface/empty-workspace-default-surface-claims',
  () => ({
    isEmptyWorkspaceDefaultSurfacePending: () => false
  })
)
vi.mock('../../../store/slices/tabs/split-landing-groups', () => ({
  hasSplitLandingGroup: () => false
}))
vi.mock('../../../store/slices/tabs/tabs-reconciliation', () => ({
  hasRecordIndependentRenderableTab: () => false
}))
vi.mock('@/lib/agent-session/launch/structured-agent-session-launch-status', () => ({
  hasStructuredAgentLaunchInWorktree: () => false
}))

import { createInitialTerminalSeeder } from './initial-terminal-seeder'

describe('initial terminal seeder on an empty host workspace', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset().mockResolvedValue(true)
    mocks.userSurface.mockReset()
  })

  it('opens what Settings chose instead of a terminal', async () => {
    mocks.userSurface.mockReturnValue(true)
    await createInitialTerminalSeeder('env-1', 'wt-1').seed()
    expect(mocks.userSurface).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('creates the terminal when Settings leaves it to the shell', async () => {
    mocks.userSurface.mockReturnValue(false)
    await createInitialTerminalSeeder('env-1', 'wt-1').seed()
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
  })

  it('creates the terminal when the chosen surface falls back to the shell', async () => {
    mocks.userSurface.mockImplementation((createShell: () => void) => {
      createShell()
      return true
    })
    await createInitialTerminalSeeder('env-1', 'wt-1').seed()
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
  })
})
