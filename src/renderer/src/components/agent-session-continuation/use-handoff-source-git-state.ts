import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import { branchName } from '@/lib/source-control/branches/branch-name'
import { getRuntimeGitStatus } from '@/runtime/source-control/git/runtime-git-status-client'
import { getRuntimeGitUpstreamStatus } from '@/runtime/source-control/git/runtime-git-sync-client'
import { useWorktreeGitOwnerTarget } from '../right-sidebar/source-control/sync/worktree-git-owner-target'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'

export type HandoffSourceGitState =
  | { kind: 'checking' }
  | { kind: 'clean'; branch: string }
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'dirty'
      uncommitted: number
      unpushed: number
      branch: string
      hasUpstream: boolean
    }

/** What a handoff to another host would leave behind: uncommitted files and unpushed commits. */
export function useHandoffSourceGitState(input: {
  worktreeId: string
  enabled: boolean
  executionHostId?: ExecutionHostId
}): { state: HandoffSourceGitState; refresh(): void } {
  const { worktreeId, enabled, executionHostId } = input
  const worktree = useAppStore((state) => findWorktreeById(state, worktreeId, executionHostId))
  const connectionId = useAppStore(
    (state) => state.repos.find((repo) => repo.id === worktree?.repoId)?.connectionId
  )
  const target = useWorktreeGitOwnerTarget(worktreeId, executionHostId)
  const worktreePath = worktree?.path
  const fallbackBranch = worktree?.branch ? branchName(worktree.branch) : ''
  const [state, setState] = useState<HandoffSourceGitState>({
    kind: 'checking'
  })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!worktreePath || !target) {
      setState({
        kind: 'unavailable',
        reason: 'Workspace host is not resolved'
      })
      return
    }
    const controller = new AbortController()
    setState({ kind: 'checking' })
    const context = {
      target,
      worktreeId,
      worktreePath,
      connectionId: connectionId ?? undefined
    }
    void (async () => {
      try {
        const status = await getRuntimeGitStatus(context, {
          admissionTier: 'interactive',
          includeLineStats: false,
          signal: controller.signal
        })
        if (status.readError) {
          if (!controller.signal.aborted) {
            setState({ kind: 'unavailable', reason: status.readError })
          }
          return
        }
        const upstream = status.upstreamStatus ?? (await getRuntimeGitUpstreamStatus(context))
        if (controller.signal.aborted) {
          return
        }
        // A path can appear staged and unstaged; count it once.
        const uncommitted = new Set(status.entries.map((entry) => entry.path)).size
        const unpushed = upstream.hasUpstream ? upstream.ahead : 0
        const branch = status.branch ? branchName(status.branch) : fallbackBranch
        setState(
          uncommitted === 0 && unpushed === 0 && upstream.hasUpstream
            ? { kind: 'clean', branch }
            : {
                kind: 'dirty',
                uncommitted,
                unpushed,
                branch,
                hasUpstream: upstream.hasUpstream
              }
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            kind: 'unavailable',
            reason: error instanceof Error ? error.message : 'Could not read git state'
          })
        }
      }
    })()
    return () => controller.abort()
  }, [enabled, worktreeId, worktreePath, connectionId, target, fallbackBranch, nonce])

  return { state, refresh }
}
