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
    defaultTuiAgent?: string
    owner: string
    repos: RepoRow[]
  } = { hostSettings: {}, owner: 'local', repos: [] }
  return state
})

vi.mock('@/store/index', () => ({
  useAppStore: { getState: () => ({ settings: {}, repos: mocks.repos }) }
}))
vi.mock('./host-empty-workspace-settings', () => ({
  // The owning host's own Settings, e.g. the VPS with "Workspace without tabs" set to Claude.
  emptyWorkspaceSettingsFor: () => mocks.hostSettings
}))
vi.mock('@/runtime/agent-launch-settings/use-host-agent-launch-preferences', () => ({
  readAgentLaunchPreferencesForWorktree: () => ({ defaultTuiAgent: mocks.defaultTuiAgent })
}))
// The workspace's owning host; the project row lookup on that host stays real.
vi.mock('@/runtime/native-chat/session-ownership/structured-agent-session-owner', () => ({
  resolveStructuredAgentSessionOwner: () => mocks.owner
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
    // The host's "Workspace without tabs" opens Claude, as on the reporting machine.
    mocks.hostSettings = { emptyWorkspaceSurface: 'agent:claude' }
    mocks.defaultTuiAgent = undefined
    mocks.owner = 'local'
    mocks.repos = [
      { id: 'repo-git', kind: 'git' },
      { id: 'repo-vps', kind: 'folder', executionHostId: 'runtime:env-1' }
    ]
  })

  it("opens the host's empty-workspace agent when the project names none", () => {
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(true)
  })

  it("lets a local git project set to Blank win over the host's empty-workspace agent", () => {
    mocks.repos[0].agentLaunchDefaults = blank
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(false)
  })

  it("lets a folder project on a paired host set to Blank win over that host's agent", () => {
    mocks.owner = 'runtime:env-1'
    mocks.repos[1].agentLaunchDefaults = blank
    expect(emptyWorkspaceOpensDefaultChat(VPS_WT)).toBe(false)
  })

  it("keeps the host's empty-workspace agent over a global Blank (project > host > global)", () => {
    mocks.defaultTuiAgent = 'blank'
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(true)
  })

  it('opens nothing when the global default is Blank and the host names no agent', () => {
    mocks.hostSettings = {}
    mocks.defaultTuiAgent = 'blank'
    expect(emptyWorkspaceOpensDefaultChat(LOCAL_WT)).toBe(false)
  })
})
