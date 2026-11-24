import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const settings: { emptyWorkspaceSurface?: string } = {}
  const tabs: Record<string, unknown[]> = {}
  return {
    settings,
    openMenu: vi.fn<(surface?: string) => boolean>(),
    opensChat: vi.fn<() => boolean>(),
    loadDetection: vi.fn<() => Promise<void>>(),
    openChat:
      vi.fn<(id: string, seedShell: () => boolean) => { primaryTabId: string | null } | null>(),
    pending: new Set<string>(),
    tabs,
    listeners: new Set<(state: unknown) => void>()
  }
})

vi.mock('@/store/index', () => ({
  useAppStore: {
    getState: () => ({ settings: mocks.settings, tabsByWorktree: mocks.tabs }),
    subscribe: (listener: (state: unknown) => void) => {
      mocks.listeners.add(listener)
      return () => mocks.listeners.delete(listener)
    }
  }
}))
vi.mock('./empty-workspace-menu-surface', () => ({
  openEmptyWorkspaceMenuSurface: (_id: string, surface: string | undefined) =>
    mocks.openMenu(surface)
}))
vi.mock('./empty-workspace-default-agent-chat', () => ({
  emptyWorkspaceOpensDefaultChat: () => mocks.opensChat(),
  loadEmptyWorkspaceDefaultChatDetection: () => mocks.loadDetection(),
  openDefaultAgentChatInEmptyWorkspace: (id: string, seedShell: () => boolean) =>
    mocks.openChat(id, seedShell)
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
    mocks.tabs = {}
    mocks.listeners.clear()
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
    // A second seeder while the first waits opens nothing more.
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    finishDetection()
    await vi.waitFor(() => expect(mocks.openChat).toHaveBeenCalledTimes(1))
    // Still held until the host publishes the agent's tab.
    expect(mocks.pending.has(WT)).toBe(true)
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    mocks.tabs = { [WT]: [{ id: 'tab-1' }] }
    for (const listener of mocks.listeners) {
      listener({ tabsByWorktree: mocks.tabs })
    }
    expect(mocks.pending.has(WT)).toBe(false)
    expect(mocks.openChat).toHaveBeenCalledTimes(1)
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
    expect(openRemoteEmptyWorkspaceUserSurface('repo::/home/me/other', shell)).toBe(false)
    mocks.settings = {}
    expect(openRemoteEmptyWorkspaceUserSurface('repo::/home/me/other', shell)).toBe(false)
    expect(shell).not.toHaveBeenCalled()
  })
})
