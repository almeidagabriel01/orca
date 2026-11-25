import { branchName } from '@/lib/source-control/branches/branch-name'
import {
  fastForwardRuntimeGit,
  fetchRuntimeGit,
  getRuntimeGitUpstreamStatus
} from '@/runtime/source-control/git/runtime-git-sync-client'
import { useAppStore } from '@/store/index'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { handoffGitContext, type HandoffGitResult } from './handoff-source-publish'

/** Fetch, then fast-forward only; every refusal comes back as a readable reason. */
export async function syncHandoffDestination(input: {
  worktreeId: string
  executionHostId?: ExecutionHostId
  expectedBranch: string
}): Promise<HandoffGitResult> {
  const hostId = input.executionHostId
  try {
    const worktree = useAppStore.getState().getKnownWorktreeById(input.worktreeId, hostId)
    const current = worktree?.branch ? branchName(worktree.branch) : null
    if (current !== input.expectedBranch) {
      return {
        ok: false,
        reason: `The destination workspace is on ${current ?? 'a detached HEAD'}, not ${input.expectedBranch}.`
      }
    }
    const context = handoffGitContext(input.worktreeId, hostId)
    try {
      await fetchRuntimeGit(context)
    } catch (error) {
      return { ok: false, reason: `Fetch failed: ${errorMessage(error)}` }
    }
    const upstream = await getRuntimeGitUpstreamStatus(context)
    if (!upstream.hasUpstream) {
      return { ok: false, reason: `${input.expectedBranch} has no upstream on the destination.` }
    }
    if (upstream.ahead > 0 && upstream.behind > 0) {
      return {
        ok: false,
        reason: `${input.expectedBranch} has diverged from ${upstream.upstreamName ?? 'its upstream'} on the destination (${upstream.ahead} ahead, ${upstream.behind} behind).`
      }
    }
    if (upstream.behind > 0) {
      try {
        await fastForwardRuntimeGit(context)
      } catch (error) {
        return {
          ok: false,
          reason: `Could not fast-forward the destination (local changes may be in the way): ${errorMessage(error)}`
        }
      }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
