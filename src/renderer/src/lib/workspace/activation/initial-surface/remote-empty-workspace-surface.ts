import { useAppStore } from '@/store/index'
import { normalizeEmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { openEmptyWorkspaceMenuSurface } from './empty-workspace-menu-surface'
import {
  emptyWorkspaceOpensDefaultChat,
  loadEmptyWorkspaceDefaultChatDetection,
  openDefaultAgentChatInEmptyWorkspace
} from './empty-workspace-default-agent-chat'
import { holdEmptyWorkspaceDefaultSurfaceForLaunch } from './empty-workspace-default-surface-claims'

/**
 * A workspace on a paired host (e.g. the Mac opening a VPS workspace) opened with no tabs shows
 * what this client's Settings chose, like a local one. False leaves the shell to the caller.
 */
export function openRemoteEmptyWorkspaceUserSurface(
  worktreeId: string,
  createShell: () => void
): boolean {
  const surface = normalizeEmptyWorkspaceSurface(
    useAppStore.getState().settings?.emptyWorkspaceSurface
  )
  if (surface === 'nothing' || openEmptyWorkspaceMenuSurface(worktreeId, surface, createShell)) {
    return true
  }
  if (!emptyWorkspaceOpensDefaultChat(worktreeId)) {
    return false
  }
  // Why hold: the host's agent list loads first, and other seeders must not add a shell meanwhile.
  const release = holdEmptyWorkspaceDefaultSurfaceForLaunch(worktreeId)
  const open = (): void => {
    release()
    const opened = openDefaultAgentChatInEmptyWorkspace(worktreeId, () => {
      createShell()
      return true
    })
    if (!opened) {
      createShell()
    }
  }
  void loadEmptyWorkspaceDefaultChatDetection(worktreeId).then(open, open)
  return true
}
