import { useAppStore } from '@/store/index'
import { openMobileEmulatorTab } from '@/lib/simulator/launch/open-mobile-emulator-tab'
import { showClientCreationActionError } from '@/lib/workspace/creation/surface-policy/client-creation-action-error'
import type { EmptyWorkspaceSurface } from '../../../../../../shared/workspace/activation/empty-workspace-surface'

/** Opens the + menu item Settings chose for an empty workspace; false leaves the shell to the caller. */
export function openEmptyWorkspaceMenuSurface(
  worktreeId: string,
  surface: EmptyWorkspaceSurface | undefined,
  seedShell: () => void
): boolean {
  if (surface !== 'new-browser' && surface !== 'new-markdown' && surface !== 'new-simulator') {
    return false
  }
  const state = useAppStore.getState()
  const groupId = state.ensureWorktreeRootGroup(worktreeId)
  const opened =
    surface === 'new-browser'
      ? state.openNewBrowserTabInActiveWorkspace(groupId)
      : surface === 'new-markdown'
        ? state.openNewMarkdownInActiveWorkspace(groupId)
        : openMobileEmulatorTab(worktreeId, { targetGroupId: groupId })
  // Why: a surface this host can't open still leaves the workspace usable.
  void opened.catch((error: unknown) => {
    showClientCreationActionError(error)
    seedShell()
  })
  return true
}
