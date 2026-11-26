import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { getRepoExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { folderWorkspaceToWorktree } from '../../../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { HeavyQueueCounts } from '../../../../../../shared/diagnostics/process-stats-types'
import {
  collectRuntimeResourceEnvironmentIds,
  hasErrorCode
} from '../../host-connections/runtime-host-resources'
import {
  getResourceUsageAllWorktrees,
  getResourceUsageFolderWorkspaces,
  getResourceUsageRepos
} from '../resource-usage-open-slices'
import {
  nextHeavyQueueChipReading,
  type HeavyQueueChipHost,
  type HeavyQueueChipOutcome,
  type HeavyQueueChipReading
} from './heavy-queue-chip-state'

const POLL_MS = 5_000
const LOCAL_ID = 'local'

async function readServer(environmentId: string): Promise<HeavyQueueChipOutcome> {
  try {
    const reply = await callRuntimeRpc<{ counts: HeavyQueueCounts | null }>(
      { kind: 'environment', environmentId },
      'diagnostics.heavyQueueCounts',
      {},
      { timeoutMs: 5_000, reuseRecentCompatibilityFailure: true }
    )
    return { kind: 'counts', counts: reply.counts }
  } catch (error) {
    return hasErrorCode(error, 'method_not_found') ? { kind: 'unsupported' } : { kind: 'error' }
  }
}

async function readLocal(): Promise<HeavyQueueChipOutcome> {
  try {
    return { kind: 'counts', counts: await window.api.memory.getHeavyQueueCounts() }
  } catch {
    // A failing local read is not "offline"; the local host just shows nothing.
    return { kind: 'unsupported' }
  }
}

/** Polls the local and each paired server's heavy queue counts every 5s while the window is visible. */
export function useHeavyQueueChips(): HeavyQueueChipHost[] {
  const t = useTranslate()
  // Same host set the Resource Manager samples, read unconditionally (its slices go empty when closed).
  const repos = useAppStore((s) => getResourceUsageRepos(s, true))
  const gitWorktrees = useAppStore((s) => getResourceUsageAllWorktrees(s, true))
  const folders = useAppStore((s) => getResourceUsageFolderWorkspaces(s, true))
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const environmentKey = useMemo(
    () =>
      collectRuntimeResourceEnvironmentIds([
        ...repos.map(getRepoExecutionHostId),
        ...gitWorktrees.map((worktree) => worktree.hostId),
        ...folders.map((folder) => folderWorkspaceToWorktree(folder).hostId)
      ]).join('\n'),
    [repos, gitWorktrees, folders]
  )
  const [readings, setReadings] = useState<Readonly<Record<string, HeavyQueueChipReading>>>({})

  useEffect(() => {
    const ids = [LOCAL_ID, ...(environmentKey ? environmentKey.split('\n') : [])]
    let cancelled = false
    const inFlight = new Set<string>()
    const poll = (): void => {
      for (const id of ids) {
        if (inFlight.has(id)) {
          continue
        }
        inFlight.add(id)
        void (id === LOCAL_ID ? readLocal() : readServer(id)).then((outcome) => {
          inFlight.delete(id)
          if (!cancelled) {
            setReadings((prev) => ({ ...prev, [id]: nextHeavyQueueChipReading(prev[id], outcome) }))
          }
        })
      }
    }
    const stop = installWindowVisibilityInterval({ run: poll, intervalMs: POLL_MS })
    return () => {
      cancelled = true
      stop()
    }
  }, [environmentKey])

  const labelOf = useCallback(
    (environmentId: string): string =>
      runtimeEnvironments.find((environment) => environment.id === environmentId)?.name ||
      environmentId,
    [runtimeEnvironments]
  )
  const localLabel = t('resourceManager.hosts.local', 'This computer')
  return useMemo(() => {
    const ids = [LOCAL_ID, ...(environmentKey ? environmentKey.split('\n') : [])]
    return ids.flatMap((id): HeavyQueueChipHost[] => {
      const reading = readings[id]
      return reading
        ? [
            {
              id,
              label: id === LOCAL_ID ? localLabel : labelOf(id),
              kind: id === LOCAL_ID ? 'local' : 'server',
              value: reading.value
            }
          ]
        : []
    })
  }, [readings, environmentKey, labelOf, localLabel])
}
