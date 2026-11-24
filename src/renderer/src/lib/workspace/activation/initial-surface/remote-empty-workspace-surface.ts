import { useAppStore } from '@/store/index'
import { normalizeEmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { openEmptyWorkspaceMenuSurface } from './empty-workspace-menu-surface'
import {
  emptyWorkspaceOpensDefaultChat,
  loadEmptyWorkspaceDefaultChatDetection,
  openDefaultAgentChatInEmptyWorkspace
} from './empty-workspace-default-agent-chat'
import { holdEmptyWorkspaceDefaultSurfaceForLaunch } from './empty-workspace-default-surface-claims'
import {
  emptyWorkspaceSettingsFor,
  refreshHostEmptyWorkspaceSettings
} from './host-empty-workspace-settings'

// ponytail: fixed wait for the host to publish the agent's tab; a launch receipt would be exact.
const HOLD_UNTIL_TAB_MS = 20_000
// Workspaces whose agent this helper is opening; activation and the host's answer both call it.
const opening = new Set<string>()

/** Keeps other seeders off until the workspace shows a tab, since host tabs arrive later. */
function releaseWhenTabArrives(worktreeId: string, release: () => void): void {
  let unsubscribe = (): void => {}
  const done = (): void => {
    clearTimeout(timer)
    unsubscribe()
    release()
  }
  const timer = setTimeout(done, HOLD_UNTIL_TAB_MS)
  unsubscribe = useAppStore.subscribe((state) => {
    if (state.tabsByWorktree[worktreeId]?.length) {
      done()
    }
  })
}

/**
 * A workspace on a paired host (e.g. the Mac opening a VPS workspace) opened with no tabs shows
 * what that host's Settings chose, read from the host first. Always handled: the shell, when it
 * is the choice or the fallback, comes through `createShell`.
 */
export function openRemoteEmptyWorkspaceUserSurface(
  worktreeId: string,
  createShell: () => void
): boolean {
  if (opening.has(worktreeId)) {
    return true
  }
  opening.add(worktreeId)
  // Why hold: the host's choice and agent list load first, and other seeders must not add a shell meanwhile.
  const release = holdEmptyWorkspaceDefaultSurfaceForLaunch(worktreeId)
  const settle = (): void => {
    opening.delete(worktreeId)
    release()
  }
  const decide = (): void => {
    const surface = normalizeEmptyWorkspaceSurface(
      emptyWorkspaceSettingsFor(useAppStore.getState(), worktreeId).emptyWorkspaceSurface
    )
    if (surface === 'nothing' || openEmptyWorkspaceMenuSurface(worktreeId, surface, createShell)) {
      return settle()
    }
    if (!emptyWorkspaceOpensDefaultChat(worktreeId)) {
      settle()
      return createShell()
    }
    const open = (): void => {
      releaseWhenTabArrives(worktreeId, settle)
      const opened = openDefaultAgentChatInEmptyWorkspace(worktreeId, () => {
        createShell()
        return true
      })
      if (!opened) {
        createShell()
      }
    }
    void loadEmptyWorkspaceDefaultChatDetection(worktreeId).then(open, open)
  }
  void refreshHostEmptyWorkspaceSettings(useAppStore.getState(), worktreeId).then(decide, decide)
  return true
}
