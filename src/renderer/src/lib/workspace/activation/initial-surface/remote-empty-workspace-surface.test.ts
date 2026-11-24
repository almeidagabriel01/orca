import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const settings: { emptyWorkspaceSurface?: string } = {}
  const tabs: Record<string, unknown[]> = {}
  return {
    settings,
    openMenu: vi.fn<(surface?: string) => boolean>(),
    refresh: vi.fn<() => Promise<void>>(),
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
vi.mock('./host-empty-workspace-settings', () => ({
  // The owning host's choice (the VPS's own Settings), read before deciding.
  emptyWorkspaceSettingsFor: () => mocks.settings,
  refreshHostEmptyWorkspaceSettings: () => mocks.refresh()
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
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.opensChat.mockReset().mockReturnValue(false)
    mocks.loadDetection.mockReset().mockResolvedValue(undefined)
    mocks.openChat.mockReset().mockReturnValue({ primaryTabId: null })
  })

  it('opens nothing when the host chose nothing', async () => {
    mocks.settings = { emptyWorkspaceSurface: 'nothing' }
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    await vi.waitFor(() => expect(mocks.pending.has(WT)).toBe(false))
    expect(shell).not.toHaveBeenCalled()
    expect(mocks.openMenu).not.toHaveBeenCalled()
  })

  it('reads the host choice before opening its + menu item, holding other seeders', async () => {
    mocks.settings = {}
    let answer!: () => void
    mocks.refresh.mockReturnValue(new Promise<void>((r) => (answer = r)))
    const shell = vi.fn()
    expect(openRemoteEmptyWorkspaceUserSurface(WT, shell)).toBe(true)
    expect(mocks.pending.has(WT)).toBe(true)
    mocks.settings = { emptyWorkspaceSurface: 'new-browser' }
    answer()
    await vi.waitFor(() => expect(mocks.openMenu).toHaveBeenCalledWith('new-browser'))
    expect(mocks.pending.has(WT)).toBe(false)
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
    await vi.waitFor(() => expect(mocks.loadDetection).toHaveBeenCalled())
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

  it('opens the shell for New Terminal, no agent to open, or an unreadable host', async () => {
    const shell = vi.fn()
    mocks.settings = { emptyWorkspaceSurface: 'new-terminal' }
    expect(openRemoteEmptyWorkspaceUserSurface('repo::/home/me/a', shell)).toBe(true)
    await vi.waitFor(() => expect(shell).toHaveBeenCalledTimes(1))
    mocks.settings = {}
    mocks.refresh.mockRejectedValue(new Error('offline'))
    expect(openRemoteEmptyWorkspaceUserSurface('repo::/home/me/b', shell)).toBe(true)
    await vi.waitFor(() => expect(shell).toHaveBeenCalledTimes(2))
  })
})
