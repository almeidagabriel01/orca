import { withProjectAgentLaunchDefaults } from '../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { structuredLaunchSeedOptions } from '../../../../shared/native-chat/input/session-options/native-chat-session-option-defaults'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { StructuredAgentId } from '../../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle'

/** What a new chat in this project starts with: the project's defaults over this host's. */
export function structuredProjectLaunchSeedOptions(
  settings: NonNullable<Parameters<typeof structuredLaunchSeedOptions>[0]>,
  repo: Repo | null,
  agent: StructuredAgentId
): Record<string, string> | undefined {
  return structuredLaunchSeedOptions(withProjectAgentLaunchDefaults(settings, repo), agent)
}
