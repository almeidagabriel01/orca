import { describe, expect, it } from 'vitest'
import { pickQuickWorkspaceAgent } from '../../../../../../shared/agent-launch/catalog/quick-workspace-agent-selection'
import { withProjectAgentLaunchDefaults } from '../../../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import {
  buildAgentLaunchRouteInput,
  findLaunchProjectRepo,
  type AgentLaunchRouteStore
} from './agent-launch-route-input'
import { resolveAgentLaunchRoute } from './agent-launch-routing'

describe('buildAgentLaunchRouteInput', () => {
  it("lets the project's terminal surface beat the host's chat default", () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: stub holds only the fields buildAgentLaunchRouteInput reads
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

describe('findLaunchProjectRepo', () => {
  it('finds a folder project being created on a paired host, so its blank default wins', () => {
    const vps = { id: 'repo-vps', kind: 'folder' as const, executionHostId: 'runtime:env-1' }
    const project = findLaunchProjectRepo(
      { repos: [{ ...vps, agentLaunchDefaults: { defaultTuiAgent: 'blank' } }] } as never,
      { kind: 'folder', repoId: 'repo-vps', executionHostId: 'runtime:env-1' },
      'runtime:env-1'
    )
    const settings = withProjectAgentLaunchDefaults({ defaultTuiAgent: 'claude' as const }, project)
    expect(settings).toEqual({ defaultTuiAgent: 'blank', agentLaunchChoices: {} })
    expect(pickQuickWorkspaceAgent(settings.defaultTuiAgent, ['claude'])).toBeNull()
  })
})
