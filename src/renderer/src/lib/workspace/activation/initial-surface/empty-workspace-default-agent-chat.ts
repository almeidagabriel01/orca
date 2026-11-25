import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import {
  emptyWorkspaceAgentLaunchSurface,
  emptyWorkspaceSurfaceAgent,
  normalizeEmptyWorkspaceAgentSurface,
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceAgentSurface
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { pickTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-selection'
import { newAgentLaunchesMayOpenChats } from '@/runtime/native-chat/local-sessions/local-structured-chats'
import { acquireAgentLaunchChoices } from '../../../agent-session/launch/inventory/host-chat-program-acquisition'
import { useAppStore } from '@/store/index'
import { emptyWorkspaceSettingsFor } from './host-empty-workspace-settings'
import type { AppState } from '@/store/types'
import {
  getAgentDetectionTargetKeyForWorktree,
  parseAgentDetectionTargetKey
} from '@/lib/agent-session/launch/inventory/useAgentDetectionTarget'
import type { AgentDetectionTarget } from '@/lib/agent-session/launch/inventory/useDetectedAgents'
import {
  ensureDetectedAgentsForTarget,
  readDetectedAgentsForTarget
} from '@/lib/agent-session/launch/inventory/agent-detection-target-inventory'
import { workspaceKindForWorktreeId } from '../../../../../../shared/agent-launch/contracts/workspace-launch-kind'
import {
  findLaunchProjectRepo,
  resolveAgentLaunchOwner,
  worktreeLaunchWorkspace
} from '@/lib/agent-session/launch/routing/agent-launch-route-input'
import { withProjectAgentLaunchDefaults } from '../../../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { notifyProjectChatFallback } from '@/lib/agent-session/launch/routing/project-chat-fallback-notice'
import {
  chosenAgentChatUnlearned,
  agentChoiceOpensAsChat
} from '@/lib/agent-session/launch/inventory/host-chat-program'
import { planAgentSessionLaunch } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'

import { createNonSecureContextUuid } from '../../../../../../shared/identifiers/non-secure-context-uuid'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { readAgentLaunchPreferencesForWorktree } from '@/runtime/agent-launch-settings/use-host-agent-launch-preferences'
import type { AgentLaunchPreferences } from '@/runtime/agent-launch-settings/host-agent-launch-preferences-resource'

type DefaultChatHost = {
  target: AgentDetectionTarget
  preferences: AgentLaunchPreferences
  /** Named in Settings, so it opens even as a terminal. */
  explicit: boolean
  /** Chat or Terminal as chosen beside it, or by the project; absent follows Open agents as. */
  surface?: EmptyWorkspaceAgentSurface
  /** The project named the surface, so its saved agent opens even as a terminal. */
  projectSurface: boolean
}

function launchProject(state: AppState, worktreeId: string) {
  const workspace = worktreeLaunchWorkspace(worktreeId)
  // Why the owner's row: a paired host's project keeps its own defaults.
  return findLaunchProjectRepo(
    state,
    workspace,
    resolveAgentLaunchOwner(state, workspace).executionHostId
  )
}

function agentSurface(
  state: AppState,
  worktreeId: string,
  project: ReturnType<typeof launchProject>
): { surface?: EmptyWorkspaceAgentSurface } {
  const surface = normalizeEmptyWorkspaceAgentSurface(
    withProjectAgentLaunchDefaults(emptyWorkspaceSettingsFor(state, worktreeId), project)
      .emptyWorkspaceAgentSurface
  )
  return surface ? { surface } : {}
}

/** Chat asks for the chat route even when Open agents as says Terminal; the host may still decline. */
const preferredChat = (host: DefaultChatHost | undefined): 'chat' | undefined =>
  host?.surface === 'chat' ? 'chat' : undefined

/** Share the host between wait/open; undefined means the workspace opens a shell regardless of agent inventory. */
function defaultChatHost(state: AppState, worktreeId: string): DefaultChatHost | undefined {
  // Why the owner's copy: a paired host keeps its own default agent.
  const preferences = readAgentLaunchPreferencesForWorktree(state, worktreeId)
  const surface = normalizeEmptyWorkspaceSurface(
    emptyWorkspaceSettingsFor(state, worktreeId).emptyWorkspaceSurface
  )
  const hostAgent = emptyWorkspaceSurfaceAgent(surface)
  const project = launchProject(state, worktreeId)
  const projectAgent = project?.agentLaunchDefaults?.defaultTuiAgent
  // A + menu item, "nothing", or a project set to Blank opens no agent: the project outranks the host's pick.
  if ((surface !== undefined && !hostAgent) || projectAgent === 'blank') {
    return undefined
  }
  const explicit = hostAgent && projectAgent ? projectAgent : hostAgent
  // Why: only a saved agent asks for a chat here; Auto must not turn catalog order into a launch (#36594).
  const saved = preferences.defaultTuiAgent === 'blank' ? null : preferences.defaultTuiAgent
  const chosen = explicit ?? saved
  const projectSurface = project?.agentLaunchDefaults?.defaultSurface !== undefined
  if (
    !chosen ||
    (!explicit &&
      !projectSurface &&
      !newAgentLaunchesMayOpenChats(withProjectAgentLaunchDefaults(state.settings ?? {}, project)))
  ) {
    return undefined
  }
  // Why: an unresolved owner is an unknown host, not the local machine.
  const target = parseAgentDetectionTargetKey(
    getAgentDetectionTargetKeyForWorktree(state, worktreeId)
  )
  return (
    target && {
      target,
      preferences: { ...preferences, defaultTuiAgent: chosen },
      explicit: explicit !== null,
      projectSurface,
      ...(explicit || projectSurface ? agentSurface(state, worktreeId, project) : {})
    }
  )
}

/** Whether an empty workspace would open an agent (chosen in Settings or the saved default). */
export function emptyWorkspaceOpensDefaultChat(worktreeId: string): boolean {
  return defaultChatHost(useAppStore.getState(), worktreeId) !== undefined
}

export function emptyWorkspaceDefaultChatAwaitsDetection(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const host = defaultChatHost(state, worktreeId)
  const detected = host && readDetectedAgentsForTarget(state, host.target)
  const workspace = worktreeLaunchWorkspace(worktreeId)
  return (
    detected === null ||
    (!!detected &&
      chosenAgentChatUnlearned(
        state,
        host?.preferences.defaultTuiAgent,
        detected,
        workspace,
        preferredChat(host)
      ))
  )
}

export async function loadEmptyWorkspaceDefaultChatDetection(worktreeId: string): Promise<void> {
  const state = useAppStore.getState()
  const host = defaultChatHost(state, worktreeId)
  if (!host) {
    return
  }
  await acquireAgentLaunchChoices(
    worktreeLaunchWorkspace(worktreeId),
    () => ensureDetectedAgentsForTarget(state, host.target),
    undefined,
    true
  ).catch(() => undefined)
}

/** Open the configured default chat for an empty workspace; null or host decline seeds a shell, never an unrequested agent TUI. */
export function openDefaultAgentChatInEmptyWorkspace(
  worktreeId: string,
  seedShell: () => boolean,
  initialCwd?: string
): { primaryTabId: string | null } | null {
  const state = useAppStore.getState()
  const host = defaultChatHost(state, worktreeId)
  if (!host) {
    return null
  }
  const detected = readDetectedAgentsForTarget(state, host.target)
  const agent = pickTuiAgent(
    host.preferences.defaultTuiAgent,
    detected ?? [],
    host.preferences.disabledTuiAgents,
    (chosen) =>
      agentChoiceOpensAsChat(
        state,
        chosen,
        worktreeLaunchWorkspace(worktreeId),
        detected,
        preferredChat(host)
      )
  )
  // Why: a chosen agent that is gone opens the shell, never another agent nobody picked.
  if (!agent || (host.explicit && agent !== host.preferences.defaultTuiAgent)) {
    if (host.explicit || host.projectSurface) {
      toast.message(
        translate(
          'settings.agents.emptyWorkspace.agentMissingToast',
          "{{agent}} isn't installed, so a terminal opened instead.",
          { agent: structuredAgentLabel(host.preferences.defaultTuiAgent ?? 'claude') }
        )
      )
    }
    return null
  }
  // No user gesture: opening this empty workspace is the one action this chat serves.
  const routeArgs = {
    agent,
    workspace: { kind: workspaceKindForWorktreeId(worktreeId), worktreeId },
    tuiCustomization: { cwd: initialCwd }
  }
  const agentSessionLaunchPlan = planAgentSessionLaunch(state, {
    requestId: createNonSecureContextUuid(),
    ...routeArgs,
    ...emptyWorkspaceAgentLaunchSurface(host.surface)
  })
  // Why: an agent that can only open as a TUI here would replace the shell with a process nobody asked for.
  if (agentSessionLaunchPlan.route === 'terminal-tui' && !host.explicit && !host.projectSurface) {
    return null
  }
  notifyProjectChatFallback(state, routeArgs, agentSessionLaunchPlan.route)
  const result = launchAgentInNewTabWithOutcome({
    agent,
    worktreeId,
    initialCwd,
    launchSource: 'unknown',
    agentSessionLaunchPlan,
    pendingActivationSpawn: true,
    // A project that asked for chat still wants its agent: the host's "no" opens its terminal.
    ...(host.projectSurface ? {} : { onStructuredHostDeclined: () => ({ opened: seedShell() }) })
  })
  if (!result || 'refused' in result) {
    return null
  }
  return { primaryTabId: result.surface.kind === 'host-published' ? null : result.surface.tabId }
}
