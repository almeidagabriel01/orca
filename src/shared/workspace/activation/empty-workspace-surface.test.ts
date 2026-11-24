import { describe, expect, it } from 'vitest'
import {
  emptyWorkspaceAgentLaunchSurface,
  emptyWorkspaceSurfaceAgent,
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
    expect(normalizeEmptyWorkspaceSurface('agent:nope')).toBeUndefined()
    expect(normalizeEmptyWorkspaceSurface('open-markdown')).toBeUndefined()
    expect(normalizeEmptyWorkspaceSurface(42)).toBeUndefined()
  })

  it('names the agent only for an agent surface', () => {
    expect(emptyWorkspaceSurfaceAgent('agent:codex')).toBe('codex')
    expect(emptyWorkspaceSurfaceAgent('new-terminal')).toBeNull()
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
