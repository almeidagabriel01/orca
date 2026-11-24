import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settings: {} as { emptyWorkspaceSurface?: string },
  openMenu: vi.fn(),
  opensChat: vi.fn(),
  loadDetection: vi.fn(),
  openChat: vi.fn(),
  pending: new Set<string>()
}))

vi.mock('@/store/index', () => ({
  useAppStore: { getState: () => ({ settings: mocks.settings }) }
}))
vi.mock('./empty-workspace-menu-surface', () => ({
  openEmptyWorkspaceMenuSurface: (_id: string, surface: string | undefined) =>
    mocks.openMenu(surface) as boolean
}))
vi.mock('./empty-workspace-default-agent-chat', () => ({
  emptyWorkspaceOpensDefaultChat: () => mocks.opensChat() as boolean,
  loadEmptyWorkspaceDefaultChatDetection: () => mocks.loadDetection() as Promise<void>,
  openDefaultAgentChatInEmptyWorkspace: (id: string, seedShell: () => boolean) =>
    mocks.openChat(id, seedShell) as { primaryTabId: string | null } | null
}))
vi.mock('./empty-workspace-default-surface-claims', () => ({
  holdEmptyWorkspaceDefaultSurfaceForLaunch: (id: string) => {
    mocks.pending.add(id)
    return () => mocks.pending.delete(id)
  }
}))

import { openRemoteEmptyWorkspaceUserSurface } from './remote-empty-workspace-surface'

const WT = 'repo::/home/me/proj'

describe('openRemoteEmptyWorkspaceUserSurface', () => {
  beforeEach(() => {
    mocks.settings = {}
    mocks.pending.clear()
    mocks.openMenu
      .mockReset()
      .mockImplementation(
        (surface?: string) =>
          surface === 'new-browser' || surface === 'new-markdown' || surface === 'new-simulator'
      )
    mocks.opensChat.mockReset().mockReturnValue(false)
    mocks.loadDetection.mockReset().mockResolvedValue(undefined)
    mocks.openChat.mockReset().mockReturnValue({ primaryTabId: null })
  })

  it('opens nothing when Settings chose nothing', () => {
    mocks.settings = { emptyWorkspaceSurface: 'nothing' }
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    expect(shell).not.toHaveBeenCalled()
    expect(mocks.openMenu).not.toHaveBeenCalled()
  })

  it('opens the chosen + menu item instead of a shell', () => {
    mocks.settings = { emptyWorkspaceSurface: 'new-browser' }
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    expect(mocks.openMenu).toHaveBeenCalledWith('new-browser')
    expect(shell).not.toHaveBeenCalled()
  })

  it('opens the chosen agent after the host agent list loads, holding other seeders', async () => {
    mocks.settings = { emptyWorkspaceSurface: 'agent:claude' }
    mocks.opensChat.mockReturnValue(true)
    let finishDetection!: () => void
    mocks.loadDetection.mockReturnValue(new Promise<void>((r) => (finishDetection = r)))
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    expect(mocks.pending.has(WT)).toBe(true)
    expect(mocks.openChat).not.toHaveBeenCalled()
    finishDetection()
    await vi.waitFor(() => expect(mocks.openChat).toHaveBeenCalled())
    expect(mocks.pending.has(WT)).toBe(false)
    expect(shell).not.toHaveBeenCalled()
  })

  it('falls back to the shell when the agent cannot open', async () => {
    mocks.settings = { emptyWorkspaceSurface: 'agent:claude' }
    mocks.opensChat.mockReturnValue(true)
    mocks.openChat.mockReturnValue(null)
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    await vi.waitFor(() => expect(shell).toHaveBeenCalledTimes(1))
  })

  it('leaves the shell to the caller for New Terminal or no agent to open', () => {
    const shell = vi.fn()
    mocks.settings = { emptyWorkspaceSurface: 'new-terminal' }
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(false)
    mocks.settings = {}
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(false)
    expect(shell).not.toHaveBeenCalled()
  })
})
