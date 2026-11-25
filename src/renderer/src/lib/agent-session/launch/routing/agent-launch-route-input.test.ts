import { describe, expect, it } from 'vitest'
import { buildAgentLaunchRouteInput, type AgentLaunchRouteStore } from './agent-launch-route-input'
import { resolveAgentLaunchRoute } from './agent-launch-routing'

describe('buildAgentLaunchRouteInput', () => {
  it("lets the project's terminal surface beat the host's chat default", () => {
    const store = {
      settings: { agentDefaultSurface: 'chat', nativeChatProviders: { claude: true } },
      repos: [{ id: 'repo-1', agentLaunchDefaults: { defaultSurface: 'terminal' } }]
    } as unknown as AgentLaunchRouteStore
    const input = buildAgentLaunchRouteInput(store, {
      agent: 'claude',
      workspace: { kind: 'git-worktree', repoId: 'repo-1', executionHostId: 'local' }
    })
    expect(input.settings).toMatchObject({
      agentDefaultSurface: 'terminal',
      nativeChatProviders: {}
    })
    expect(resolveAgentLaunchRoute(input)).toBe('terminal-tui')
  })
})
