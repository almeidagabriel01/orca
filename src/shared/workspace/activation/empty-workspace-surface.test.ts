import { describe, expect, it } from 'vitest'
import {
  emptyWorkspaceAgentLaunchSurface,
  emptyWorkspaceSkipsHostShell,
  emptyWorkspaceSurfaceOpensAgent,
  normalizeEmptyWorkspaceAgentSurface,
  normalizeEmptyWorkspaceSurface
} from './empty-workspace-surface'

describe('normalizeEmptyWorkspaceSurface', () => {
  it('keeps + menu items, known agents and nothing; drops anything else', () => {
    expect(normalizeEmptyWorkspaceSurface('new-browser')).toBe('new-browser')
    expect(normalizeEmptyWorkspaceSurface('agent:claude-agent-teams')).toBe(
      'agent:claude-agent-teams'
    )
    expect(normalizeEmptyWorkspaceSurface('nothing')).toBe('nothing')
    expect(normalizeEmptyWorkspaceSurface('default-agent')).toBe('default-agent')
    expect(normalizeEmptyWorkspaceSurface('agent:nope')).toBeUndefined()
    expect(normalizeEmptyWorkspaceSurface('open-markdown')).toBeUndefined()
    expect(normalizeEmptyWorkspaceSurface(42)).toBeUndefined()
  })

  it('opens an agent for the default agent and an older agent:<id>, whose id is ignored', () => {
    expect(emptyWorkspaceSurfaceOpensAgent('default-agent')).toBe(true)
    expect(emptyWorkspaceSurfaceOpensAgent('agent:codex')).toBe(true)
    expect(emptyWorkspaceSurfaceOpensAgent('new-terminal')).toBe(false)
    expect(emptyWorkspaceSurfaceOpensAgent(undefined)).toBe(false)
  })
})

describe('empty workspace agent surface', () => {
  it('keeps chat and terminal only', () => {
    expect(normalizeEmptyWorkspaceAgentSurface('chat')).toBe('chat')
    expect(normalizeEmptyWorkspaceAgentSurface('terminal')).toBe('terminal')
    expect(normalizeEmptyWorkspaceAgentSurface('tui')).toBeUndefined()
  })

  it('asks for chat, forces terminal, and leaves unset to Open agents as', () => {
    expect(emptyWorkspaceAgentLaunchSurface('chat')).toEqual({ preferredSurface: 'chat' })
    expect(emptyWorkspaceAgentLaunchSurface('terminal')).toEqual({ requestedSurface: 'terminal' })
    expect(emptyWorkspaceAgentLaunchSurface(undefined)).toEqual({})
  })
})

describe('emptyWorkspaceSkipsHostShell', () => {
  it('skips the host shell only for a choice that is not a shell', () => {
    expect(emptyWorkspaceSkipsHostShell({})).toBe(false)
    expect(emptyWorkspaceSkipsHostShell({ emptyWorkspaceSurface: 'new-terminal' })).toBe(false)
    expect(emptyWorkspaceSkipsHostShell({ emptyWorkspaceSurface: 'agent:claude' })).toBe(true)
    expect(emptyWorkspaceSkipsHostShell({ emptyWorkspaceSurface: 'default-agent' })).toBe(true)
    expect(emptyWorkspaceSkipsHostShell({ emptyWorkspaceSurface: 'nothing' })).toBe(true)
    expect(emptyWorkspaceSkipsHostShell({ emptyWorkspaceSurface: 'new-browser' })).toBe(true)
  })
})
