import { describe, expect, it } from 'vitest'
import {
  normalizeProjectAgentLaunchDefaults,
  withProjectAgentLaunchDefaults
} from './project-agent-launch-defaults'
import { structuredLaunchSeedOptions } from '../../native-chat/input/session-options/native-chat-session-option-defaults'

const host = {
  defaultTuiAgent: 'claude' as const,
  agentLaunchChoices: { codex: { model: 'gpt-5.4', options: { effort: 'high' } } },
  agentPermissionDefault: 'own' as const
}

describe('withProjectAgentLaunchDefaults', () => {
  it('overrides the host default agent and model while keeping host-only settings', () => {
    const settings = withProjectAgentLaunchDefaults(host, {
      agentLaunchDefaults: {
        defaultTuiAgent: 'codex',
        agentLaunchChoices: { codex: { model: 'gpt-5.3-codex', options: { effort: 'medium' } } }
      }
    })
    expect(settings.defaultTuiAgent).toBe('codex')
    expect(structuredLaunchSeedOptions(settings, 'codex')).toMatchObject({
      model: 'gpt-5.3-codex',
      effort: 'medium',
      permissionMode: 'own'
    })
    expect(host.agentLaunchChoices.codex).toEqual({
      model: 'gpt-5.4',
      options: { effort: 'high' }
    })
  })

  it('does not carry the host effort into a different project model', () => {
    const settings = withProjectAgentLaunchDefaults(host, {
      agentLaunchDefaults: { agentLaunchChoices: { codex: { model: 'gpt-5.3-codex' } } }
    })
    expect(settings.agentLaunchChoices?.codex).toEqual({ model: 'gpt-5.3-codex' })
  })

  it('lets a project surface beat the host global and per-agent chat choices', () => {
    const settings = withProjectAgentLaunchDefaults(
      { ...host, agentDefaultSurface: 'chat' as const, nativeChatProviders: { claude: true } },
      { agentLaunchDefaults: normalizeProjectAgentLaunchDefaults({ defaultSurface: 'terminal' }) }
    )
    expect(settings).toMatchObject({
      agentDefaultSurface: 'terminal',
      emptyWorkspaceAgentSurface: 'terminal',
      nativeChatProviders: {}
    })
    expect(normalizeProjectAgentLaunchDefaults({ defaultSurface: 'tui' })).toBeUndefined()
  })
})
