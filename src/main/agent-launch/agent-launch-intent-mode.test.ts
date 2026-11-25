import { describe, expect, it } from 'vitest'
import type { ProjectAgentSurface } from '../../shared/agent-launch/choices/project-agent-launch-defaults'
import type { AgentLaunchIntent } from '../../shared/agent-launch/contracts/agent-launch-intent'
import { decideAgentLaunchIntentMode } from './agent-launch-intent-mode'
import { readLaunchProject } from './agent-launch-mode-settings'

function hostWith(global: ProjectAgentSurface, project: ProjectAgentSurface) {
  const repo = { id: 'repo-1', agentLaunchDefaults: { defaultSurface: project } }
  return {
    requireStore: () => ({ getSettings: () => ({ agentDefaultSurface: global }) }),
    showRepo: async (selector: unknown) => {
      if (selector !== 'id:repo-1') {
        throw new Error('repo_not_found')
      }
      return repo
    },
    showTerminalWorkspaceLaunchScope: async () => ({ repo })
  }
}

async function modeOf(
  runtime: ReturnType<typeof hostWith>,
  launch: Partial<AgentLaunchIntent> = {}
): Promise<string> {
  const intent: AgentLaunchIntent = {
    agent: 'claude',
    target: { kind: 'create-worktree', create: { repo: 'id:repo-1' } },
    ...launch
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake answers the only two lookups a launch's project needs.
  const host = runtime as unknown as Parameters<typeof readLaunchProject>[0]
  const project = await readLaunchProject(host, { repo: 'id:repo-1' })
  return decideAgentLaunchIntentMode({ intent, runtime, project }).mode
}

describe("host launches follow the project's Open as", () => {
  it.each([
    ['terminal', 'chat', 'terminal', 'structured'],
    ['chat', 'terminal', 'structured', 'terminal']
  ] as const)('a %s project over a %s host opens %s', async (project, global, mode, explicit) => {
    const runtime = hostWith(global, project)
    expect(await modeOf(runtime)).toBe(mode)
    // A nativeChatDefault stamp yields to the project; only `surface` beats it.
    expect(await modeOf(runtime, { nativeChatDefault: global === 'chat' })).toBe(mode)
    expect(await modeOf(runtime, { surface: global })).toBe(explicit)
  })
})
