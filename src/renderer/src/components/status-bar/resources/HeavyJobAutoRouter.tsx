import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '../../../store/workspaces/catalog/workspace-record-fields'
import { getIndexedAllWorktrees } from '../../../store/slices/worktrees/listing/worktree-catalog-index'
import { getFolderWorkspaceWorktreeHostId } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'
import { collectRuntimeResourceEnvironmentIds } from '../host-connections/runtime-host-resources'
import type { HeavyMoveHost } from './popover/resource-heavy-job-move'
import { pollHeavyQueues } from './heavy-queue-auto-route-poll'
import { useHeavyJobAutoRouter } from './use-heavy-job-auto-router'
import { useResourceViewVisible } from './use-resource-view-visible'

const POLL_MS = 5_000

function readHeavyQueue(hostId: string): Promise<unknown> {
  return hostId === 'local'
    ? window.api.memory.heavyQueue()
    : callRuntimeRpc<unknown>(
        { kind: 'environment', environmentId: hostId },
        'diagnostics.heavyQueue',
        undefined,
        { timeoutMs: POLL_MS, background: true, reuseRecentCompatibilityFailure: true }
      )
}

/** This client's host and each connected paired server that holds one of its workspaces. */
function candidateHostIds(state: AppState): string[] {
  const environmentIds = collectRuntimeResourceEnvironmentIds([
    ...state.repos.map(getRepoExecutionHostId),
    ...getIndexedAllWorktrees(selectWorktreesByRepo(state)).map((worktree) => worktree.hostId),
    ...selectFolderWorkspaces(state).map(getFolderWorkspaceWorktreeHostId)
  ]).filter((id) => state.runtimeStatusByEnvironmentId.get(id)?.status)
  // Why: the web client has no host of its own to read.
  return isPairedWebClientWindow() ? environmentIds : ['local', ...environmentIds]
}

function hostLabel(id: string): string {
  return id === 'local'
    ? translate('resourceManager.hosts.local', 'This computer')
    : useAppStore.getState().runtimeEnvironments.find((environment) => environment.id === id)
        ?.name || id
}

/**
 * Reads every host's heavy queue so "Run on" routes new jobs with the Resource Manager closed.
 * Mounted only while a preference is saved; paused while the window is hidden, since moves of
 * this computer's jobs need a visible window.
 */
export function HeavyJobAutoRouter(): null {
  const visible = useResourceViewVisible()
  const [hosts, setHosts] = useState<HeavyMoveHost[]>([])

  useEffect(() => {
    if (!visible) {
      return
    }
    let cancelled = false
    let inFlight = false
    const unsupported = new Set<string>()
    const tick = (): void => {
      if (inFlight) {
        return
      }
      inFlight = true
      const state = useAppStore.getState()
      void pollHeavyQueues(state.settings, candidateHostIds(state), readHeavyQueue, unsupported)
        .then((polled) => {
          if (cancelled) {
            return
          }
          const next = polled.map(({ id, queue }) => ({ id, label: hostLabel(id), queue }))
          setHosts((prev) => (prev.length === 0 && next.length === 0 ? prev : next))
        })
        .finally(() => {
          inFlight = false
        })
    }
    tick()
    const timer = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      setHosts([])
    }
  }, [visible])

  useHeavyJobAutoRouter(hosts)
  return null
}
