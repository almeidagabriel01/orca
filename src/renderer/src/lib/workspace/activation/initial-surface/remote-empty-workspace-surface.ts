import { useAppStore } from '@/store/index'
import { normalizeEmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'
import { openEmptyWorkspaceMenuSurface } from './empty-workspace-menu-surface'
import {
  emptyWorkspaceOpensDefaultChat,
  loadEmptyWorkspaceDefaultChatDetection,
  openDefaultAgentChatInEmptyWorkspace
} from './empty-workspace-default-agent-chat'
import { holdEmptyWorkspaceDefaultSurfaceForLaunch } from './empty-workspace-default-surface-claims'

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
    opening.delete(worktreeId)
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
  if (opening.has(worktreeId)) {
    return true
  }
  if (!emptyWorkspaceOpensDefaultChat(worktreeId)) {
    return false
  }
  opening.add(worktreeId)
  // Why hold: the host's agent list loads first, and other seeders must not add a shell meanwhile.
  const release = holdEmptyWorkspaceDefaultSurfaceForLaunch(worktreeId)
  const open = (): void => {
    releaseWhenTabArrives(worktreeId, release)
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
