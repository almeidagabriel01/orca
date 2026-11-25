import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { chatUnavailableLabel } from '@/components/agent/launch-menu/agent-menu-row-presentation'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { hostChatAnswer } from './new-tab-agent-menu-rows'
import {
  buildAgentLaunchRouteInput,
  findLaunchProjectRepo,
  resolveAgentLaunchOwner,
  type AgentLaunchRouteArgs,
  type AgentLaunchRouteStore
} from './agent-launch-route-input'
import type { AgentLaunchRoute } from './agent-launch-routing'
import type { AppState } from '@/store/types'

function fallbackReason(store: AgentLaunchRouteStore, args: AgentLaunchRouteArgs): string {
  const answer = hostChatAnswer(
    buildAgentLaunchRouteInput(store, { ...args, preferredSurface: 'chat' })
  )
  switch (answer) {
    case 'no-chats':
      return translate('settings.agents.projectSurfaceFallbackNoChats', "This host can't run chats")
    case 'not-yet-known':
      return chatUnavailableLabel('check-failed')
    case 'yes':
      return chatUnavailableLabel('not-on-host')
    default:
      return chatUnavailableLabel(answer)
  }
}

/** The project asked for a chat but this host opens the agent's terminal instead; say why. */
export function notifyProjectChatFallback(
  store: AgentLaunchRouteStore & Pick<AppState, 'repos'>,
  args: AgentLaunchRouteArgs,
  route: AgentLaunchRoute
): void {
  const project = findLaunchProjectRepo(
    store,
    args.workspace,
    resolveAgentLaunchOwner(store, args.workspace).executionHostId
  )
  if (route !== 'terminal-tui' || project?.agentLaunchDefaults?.defaultSurface !== 'chat') {
    return
  }
  toast.message(
    translate(
      'settings.agents.projectSurfaceFallbackToast',
      '{{agent}} opened in a terminal: {{reason}}.',
      { agent: structuredAgentLabel(args.agent), reason: fallbackReason(store, args) }
    )
  )
}
