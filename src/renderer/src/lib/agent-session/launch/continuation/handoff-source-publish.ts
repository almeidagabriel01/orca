import { runtimeTargetForWorkspaceOwner } from '@/lib/workspace/ownership/resolve-owner'
import { getConnectionId } from '@/lib/workspace/ownership/connection-context'
import { requireGitOwnerTarget } from '@/components/right-sidebar/source-control/sync/worktree-git-owner-target'
import type { RuntimeGitContext } from '@/runtime/source-control/git/runtime-git-client-context'
import {
  commitRuntimeGit,
  getRuntimeGitUpstreamStatus,
  pushRuntimeGit
} from '@/runtime/source-control/git/runtime-git-sync-client'
import { stageRuntimeGitWorktreeScope } from '@/runtime/source-control/git/runtime-git-working-tree-client'
import { useAppStore } from '@/store/index'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

export type HandoffGitResult = { ok: true } | { ok: false; reason: string }

/** The git context pinned to the workspace's owner host, even when another host shares its id. */
export function handoffGitContext(
  worktreeId: string,
  executionHostId?: ExecutionHostId
): RuntimeGitContext {
  const state = useAppStore.getState()
  const worktree = state.getKnownWorktreeById(worktreeId, executionHostId)
  if (!worktree) {
    throw new Error('Workspace not found.')
  }
  const target = runtimeTargetForWorkspaceOwner(state, {
    workspaceId: worktreeId,
    ...(executionHostId ? { hostId: executionHostId } : {})
  })
  return {
    target: requireGitOwnerTarget(target),
    worktreeId,
    worktreePath: worktree.path,
    connectionId: getConnectionId(worktreeId) ?? undefined
  }
}

const NOTHING_TO_COMMIT = /nothing (added )?to commit|no changes added to commit/i

/** Stage everything not ignored, commit, then push (publishing when the branch has no upstream). */
export async function commitAndPushHandoffSource(input: {
  worktreeId: string
  executionHostId?: string
  message: string
  commit: boolean
}): Promise<HandoffGitResult> {
  try {
    const context = handoffGitContext(input.worktreeId, input.executionHostId as ExecutionHostId)
    if (input.commit) {
      await stageRuntimeGitWorktreeScope(context, 'all')
      const result = await commitRuntimeGit(context, input.message)
      // A clean tree is fine: the hand-off then just publishes what is already committed.
      if (!result.success && !NOTHING_TO_COMMIT.test(result.error ?? '')) {
        return { ok: false, reason: result.error || 'Commit failed.' }
      }
    }
    const upstream = await getRuntimeGitUpstreamStatus(context)
    await pushRuntimeGit(context, { publish: !upstream.hasUpstream })
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
