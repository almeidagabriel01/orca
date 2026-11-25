import { beforeEach, describe, expect, it, vi } from 'vitest'

type RepoRow = {
  id: string
  kind: 'git' | 'folder'
  executionHostId?: string
  agentLaunchDefaults?: { defaultTuiAgent?: string }
}

const mocks = vi.hoisted(() => {
  const state: {
    hostSettings: { emptyWorkspaceSurface?: string }
    /** The global default agent (Settings), this app's own. */
    defaultTuiAgent?: string
    owner: string
    repos: RepoRow[]
  } = { hostSettings: {}, owner: 'local', repos: [] }
  return state
})

vi.mock('@/store/index', () => ({
  useAppStore: {
    getState: () => ({ settings: { defaultTuiAgent: mocks.defaultTuiAgent }, repos: mocks.repos })
  }
}))
vi.mock('./host-empty-workspace-settings', () => ({
  // The owning host's own Settings, e.g. the VPS with "Workspace without tabs" set to Claude.
  emptyWorkspaceSettingsFor: () => mocks.hostSettings
}))
// The workspace's owning host; preferences and the project row lookup on that host stay real.
vi.mock('@/runtime/native-chat/session-ownership/structured-agent-session-owner', () => ({
  resolveStructuredAgentSessionOwner: () => mocks.owner
}))
// No paired host has reported its preferences yet, so the project's layer decides there.
vi.mock('@/store/slices/runtime-status/views/runtime-status-owner', () => ({
  readRuntimeStatuses: () => new Map()
}))
vi.mock('@/lib/agent-session/launch/inventory/useAgentDetectionTarget', () => ({
  getAgentDetectionTargetKeyForWorktree: () => 'local',
  parseAgentDetectionTargetKey: () => ({ kind: 'local' })
}))
vi.mock('@/runtime/native-chat/local-sessions/local-structured-chats', () => ({
  newAgentLaunchesMayOpenChats: () => true
}))

import { emptyWorkspaceOpensDefaultChat } from './empty-workspace-default-agent-chat'

const LOCAL_WT = 'repo-git::/home/me/proj'
const VPS_WT = 'repo-vps::/srv/app::workspace:0b6c1d2e-3f4a-4b5c-8d7e-9f0a1b2c3d4e'
const blank = { defaultTuiAgent: 'blank' }

describe('emptyWorkspaceOpensDefaultChat', () => {
  beforeEach(() => {
    // The host's "Workspace without tabs" was saved as Claude, as on the reporting machines.
    mocks.hostSettings = { emptyWorkspaceSurface: 'agent:claude' }
    mocks.defaultTuiAgent = undefined
    mocks.owner = 'local'
    mocks.repos = [
      { id: 'repo-git', kind: 'git' },
      { id: 'repo-vps', kind: 'folder', executionHostId: 'runtime:env-1' }
    ]
  })

  it("ignores the host's saved agent: global Blank and no project default open no agent", () => {
    mocks.defaultTuiAgent = 'blank'
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(false)
  })

  it('opens the global default agent when the project names none', () => {
    mocks.defaultTuiAgent = 'claude'
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(true)
  })

  it('lets a local git project set to Blank win over a global agent', () => {
    mocks.defaultTuiAgent = 'claude'
    mocks.repos[0].agentLaunchDefaults = blank
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(false)
  })

  it('lets a folder project on a paired host set to Blank open no agent', () => {
    mocks.owner = 'runtime:env-1'
    mocks.repos[1].agentLaunchDefaults = blank
    expect(emptyWorkspaceOpensDefaultChat(VPS_WT)).toBe(false)
  })

  it("opens a project's own agent even when the global default is Blank", () => {
    mocks.defaultTuiAgent = 'blank'
    mocks.repos[0].agentLaunchDefaults = { defaultTuiAgent: 'codex' }
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(true)
  })

  it('opens the default agent for the new default-agent choice too', () => {
    mocks.hostSettings = { emptyWorkspaceSurface: 'default-agent' }
    mocks.defaultTuiAgent = 'claude'
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(true)
  })
})
