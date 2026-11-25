import { getRuntimeGitUpstreamStatus } from '@/runtime/source-control/git/runtime-git-sync-client'
import { useAppStore } from '@/store/index'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import {
  commitAndPushHandoffSource,
  handoffGitContext,
  type HandoffGitResult
} from './handoff-source-publish'

/** Same shape the composer sends for a reused remote branch: check out that branch, never a suffixed copy. */
export function handoffWorkspaceCreateArgs(
  branch: string,
  upstreamName: string | undefined
): { name: string; baseBranch: string; branchNameOverride: string } {
  // ponytail: assumes the destination clone names the remote like the source; falls back to origin.
  const baseBranch = upstreamName?.endsWith(`/${branch}`) ? upstreamName : `origin/${branch}`
  return { name: branch, baseBranch, branchNameOverride: branch }
}

/** Publish the source branch if it has no upstream, then create its workspace on the destination host. */
export async function createHandoffDestinationWorkspace(input: {
  sourceWorktreeId: string
  sourceHostId?: ExecutionHostId
  hostId: ExecutionHostId
  repoId: string
  branch: string
}): Promise<HandoffGitResult> {
  try {
    const context = handoffGitContext(input.sourceWorktreeId, input.sourceHostId)
    let upstream = await getRuntimeGitUpstreamStatus(context)
    if (!upstream.hasUpstream) {
      const published = await commitAndPushHandoffSource({
        worktreeId: input.sourceWorktreeId,
        executionHostId: input.sourceHostId,
        message: '',
        commit: false
      })
      if (!published.ok) {
        return published
      }
      upstream = await getRuntimeGitUpstreamStatus(context)
    }
    const args = handoffWorkspaceCreateArgs(input.branch, upstream.upstreamName)
    await useAppStore
      .getState()
      .createWorktree(
        input.repoId,
        args.name,
        args.baseBranch,
        'inherit',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        args.branchNameOverride,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { executionHostId: input.hostId, branchIntent: 'open-existing-v2' }
      )
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
