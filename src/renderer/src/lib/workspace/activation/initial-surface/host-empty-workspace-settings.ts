import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { AppState } from '@/store/types'
import {
  getAgentDetectionTargetKeyForWorktree,
  parseAgentDetectionTargetKey
} from '@/lib/agent-session/launch/inventory/useAgentDetectionTarget'
import {
  normalizeEmptyWorkspaceAgentSurface,
  normalizeEmptyWorkspaceSurface,
  type EmptyWorkspaceSurfaceSettings
} from '../../../../../../shared/workspace/activation/empty-workspace-surface'

// Each paired host's own choice, as its settings last reported it.
const byEnvironment = new Map<string, EmptyWorkspaceSurfaceSettings>()

function runtimeEnvironmentOf(state: AppState, worktreeId: string): string | null {
  const target = parseAgentDetectionTargetKey(
    getAgentDetectionTargetKeyForWorktree(state, worktreeId)
  )
  return target?.kind === 'runtime' ? target.environmentId : null
}

/** Keeps a host's choice as Settings just wrote it, before the next read. */
export function rememberHostEmptyWorkspaceSettings(
  environmentId: string,
  settings: Partial<Record<keyof EmptyWorkspaceSurfaceSettings, unknown>>
): void {
  const surface = normalizeEmptyWorkspaceSurface(settings.emptyWorkspaceSurface)
  const agentSurface = normalizeEmptyWorkspaceAgentSurface(settings.emptyWorkspaceAgentSurface)
  byEnvironment.set(environmentId, {
    ...(surface ? { emptyWorkspaceSurface: surface } : {}),
    ...(agentSurface ? { emptyWorkspaceAgentSurface: agentSurface } : {})
  })
}

/**
 * The empty-workspace choice of the host that owns the workspace, like Open agents as: a paired
 * host's (e.g. the VPS) for its workspaces, this app's own for local ones.
 */
export function emptyWorkspaceSettingsFor(
  state: AppState,
  worktreeId: string
): EmptyWorkspaceSurfaceSettings {
  const environmentId = runtimeEnvironmentOf(state, worktreeId)
  return environmentId ? (byEnvironment.get(environmentId) ?? {}) : (state.settings ?? {})
}

/** Reads the owning host's current choice; a failed read keeps the last one. */
export async function refreshHostEmptyWorkspaceSettings(
  state: AppState,
  worktreeId: string
): Promise<void> {
  const environmentId = runtimeEnvironmentOf(state, worktreeId)
  if (!environmentId) {
    return
  }
  const result = await callRuntimeRpc<{ settings: Record<string, unknown> }>(
    { kind: 'environment', environmentId },
    'settings.get',
    undefined,
    { timeoutMs: 5_000 }
  )
  rememberHostEmptyWorkspaceSettings(environmentId, result.settings)
}
