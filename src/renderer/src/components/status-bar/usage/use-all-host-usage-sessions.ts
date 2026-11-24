import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import {
  readOwnerAccounts,
  subscribeOwnerAccounts
} from '@/runtime/provider-accounts/observations/owner-accounts-stream'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { getOwnerUsageAccounts } from '../composition/status-bar-usage-chips'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { identifyHostSessions, type UsageAgentSession } from './usage-account-sessions'
import { useHostUsageSessions, usageHostKey } from './use-usage-account-sessions'

/** Bumps when any listed host's accounts snapshot changes; keeps their streams open meanwhile. */
function useOwnerAccountsRevision(environmentIds: readonly string[]): number {
  const [revision, setRevision] = useState(0)
  const idsKey = environmentIds.join('|')
  useEffect(() => {
    if (!idsKey) {
      return
    }
    const stops = idsKey
      .split('|')
      .map((id) => subscribeOwnerAccounts(id, () => setRevision((value) => value + 1)))
    return () => stops.forEach((stop) => stop())
  }, [idsKey])
  return revision
}

/**
 * The shown owner's agents, plus every other host's agents tagged with the login they bill, so a
 * chip lists the same account's agents on the Mac and the VPS together.
 */
export function useAllHostUsageSessions(owner: RuntimeClientTarget | null): UsageAgentSession[] {
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
  const accountsRevision = useOwnerAccountsRevision(remoteOthers)
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
      const snapshot = key === 'local' ? null : (readOwnerAccounts(key)?.snapshot ?? null)
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
        settings
      )
      return identifyHostSessions(sessions, accounts, {
        environmentId: key === 'local' ? null : key,
        label: labels[index] ?? key
      })
    })
    return [...own, ...elsewhere]
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- accountsRevision names the snapshots read.
  }, [byHost, others, ownerKey, labels, settings, localRateLimits, accountsRevision])
}
