import { withProjectAgentLaunchDefaults } from '../../shared/agent-launch/choices/project-agent-launch-defaults'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { RuntimeRepoSelector } from '../runtime/workspaces/catalog/runtime-repo-selector'
import type { AgentLaunchModeSettings } from './agent-launch-mode'

type LaunchProject = Parameters<typeof withProjectAgentLaunchDefaults>[1]

/** A caller's stamp or the host's settings, under the launch's project; only an explicit surface beats the project. */
export function readAgentLaunchModeSettings(
  runtime: { requireStore(): { getSettings(): AgentLaunchModeSettings | null } },
  caller?: { agent?: string; nativeChatDefault?: boolean },
  project?: LaunchProject
): AgentLaunchModeSettings | null {
  const settings = readCallerOrHostSettings(runtime, caller)
  return settings && withProjectAgentLaunchDefaults(settings, project)
}

function readCallerOrHostSettings(
  runtime: Parameters<typeof readAgentLaunchModeSettings>[0],
  caller: Parameters<typeof readAgentLaunchModeSettings>[1]
): AgentLaunchModeSettings | null {
  if (caller?.nativeChatDefault !== undefined) {
    return caller.agent === undefined
      ? {}
      : { nativeChatProviders: { [caller.agent]: caller.nativeChatDefault } }
  }
  try {
    return runtime.requireStore().getSettings()
  } catch (error) {
    console.warn('[agent-launch] could not resolve chat preference', error)
    return null
  }
}

/** The project a launch's workspace belongs to; null when it has none or this host cannot read it. */
export async function readLaunchProject(
  runtime: Pick<OrcaRuntimeService, 'showTerminalWorkspaceLaunchScope' | 'showRepo'>,
  place: { worktree: string } | { repo: RuntimeRepoSelector }
): Promise<LaunchProject> {
  try {
    return 'worktree' in place
      ? (await runtime.showTerminalWorkspaceLaunchScope(place.worktree)).repo
      : await runtime.showRepo(place.repo)
  } catch {
    return null
  }
}
