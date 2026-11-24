import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import { useAppStore } from '@/store/index'
import {
  readOwnerAccounts,
  subscribeOwnerAccounts
} from '@/runtime/provider-accounts/observations/owner-accounts-stream'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import {
  getOwnerUsageAccounts,
  type LocalUsageAccountRosters
} from '../composition/status-bar-usage-chips'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { identifyHostSessions, type UsageAgentSession } from './usage-account-sessions'
import { useHostUsageSessions, usageHostKey } from './use-usage-account-sessions'

/** Each listed host's accounts snapshot, kept current while its stream stays open. */
function useOwnerAccountSnapshots(
  environmentIds: readonly string[]
): ReadonlyMap<string, ProviderAccountsSnapshot> {
  const [snapshots, setSnapshots] = useState<ReadonlyMap<string, ProviderAccountsSnapshot>>(
    () => new Map()
  )
  const idsKey = environmentIds.join('|')
  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : []
    const read = (): void =>
      setSnapshots(
        new Map(
          ids.flatMap((id) => {
            const snapshot = readOwnerAccounts(id)?.snapshot
            return snapshot ? [[id, snapshot] as const] : []
          })
        )
      )
    const unsubscribes = ids.map((id) => subscribeOwnerAccounts(id, read))
    read()
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [idsKey])
  return snapshots
}

/**
 * The shown owner's agents, plus every other host's agents tagged with the login they bill, so a
 * chip lists the same account's agents on the Mac and the VPS together.
 */
export function useAllHostUsageSessions(
  owner: RuntimeClientTarget | null,
  localRosters: LocalUsageAccountRosters
): UsageAgentSession[] {
  const ownerKey = usageHostKey(owner)
  const environmentIds = useAppStore(
    useShallow((s) => s.runtimeEnvironments.map((environment) => environment.id))
  )
  const others = useMemo(
    () => ['local', ...environmentIds].filter((key) => key !== ownerKey),
    [environmentIds, ownerKey]
  )
  const hosts = useMemo(() => (ownerKey ? [ownerKey, ...others] : others), [ownerKey, others])
  const byHost = useHostUsageSessions(hosts)
  const remoteOthers = useMemo(() => others.filter((key) => key !== 'local'), [others])
  const snapshots = useOwnerAccountSnapshots(remoteOthers)
  const settings = useAppStore((s) => s.settings)
  const localRateLimits = useAppStore((s) => s.rateLimits)
  const labels = useAppStore(
    useShallow((s) =>
      others.map((key) =>
        selectExecutionHostDisplayLabel(
          s,
          key === 'local' ? LOCAL_EXECUTION_HOST_ID : toRuntimeExecutionHostId(key)
        )
      )
    )
  )

  return useMemo(() => {
    const own = ownerKey ? (byHost.get(ownerKey) ?? []) : []
    const elsewhere = others.flatMap((key, index) => {
      const sessions = byHost.get(key) ?? []
      if (sessions.length === 0) {
        return []
      }
      const snapshot = key === 'local' ? null : (snapshots.get(key) ?? null)
      if (key !== 'local' && !snapshot) {
        return []
      }
      const accounts = getOwnerUsageAccounts(
        {
          owner: null,
          rateLimits: snapshot?.rateLimits ?? localRateLimits,
          accounts: snapshot,
          remoteOwner: snapshot ? { environmentId: key, label: labels[index] ?? key } : null,
          refreshRemote: null
        },
        settings,
        undefined,
        localRosters
      )
      return identifyHostSessions(sessions, accounts, {
        environmentId: key === 'local' ? null : key,
        label: labels[index] ?? key
      })
    })
    return [...own, ...elsewhere]
  }, [byHost, others, ownerKey, labels, settings, localRateLimits, localRosters, snapshots])
}
