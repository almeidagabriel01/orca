import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import type { AccountNames } from '../../../../shared/agent-accounts/account-names'
import { planAccountNamesSync } from '../../../../shared/agent-accounts/account-name-identity'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { callRuntimeRpc } from '../rpc/calls/runtime-rpc-call'
import { readOwnerAccounts, subscribeOwnerAccounts } from './observations/owner-accounts-stream'

type NamesReply = { accountNames: AccountNames }

const LOCAL: RuntimeClientTarget = { kind: 'local' }
// Not a user action: never wake a host Orca stopped idle.
const SYNC_OPTIONS = { background: true, timeoutMs: 15_000 }

const getNames = async (target: RuntimeClientTarget): Promise<AccountNames> =>
  (await callRuntimeRpc<NamesReply>(target, 'accounts.getNames', undefined, SYNC_OPTIONS))
    .accountNames

/** Gives this desktop and one host each other's newer names; writes only the side that lacks some. */
async function syncHost(environmentId: string): Promise<void> {
  const target: RuntimeClientTarget = { kind: 'environment', environmentId }
  const [local, remote] = await Promise.all([getNames(LOCAL), getNames(target)])
  const { toLocal, toRemote } = planAccountNamesSync(local, remote)
  if (toRemote) {
    await callRuntimeRpc(target, 'accounts.mergeNames', { names: toRemote }, SYNC_OPTIONS)
  }
  if (toLocal) {
    // Lands in settings; the change re-syncs every other host.
    await callRuntimeRpc(LOCAL, 'accounts.mergeNames', { names: toLocal }, SYNC_OPTIONS)
  }
}

const running = new Set<string>()
const rerun = new Set<string>()

function requestSync(environmentId: string): void {
  if (running.has(environmentId)) {
    rerun.add(environmentId)
    return
  }
  running.add(environmentId)
  // Older hosts answer method_not_found and offline ones fail; both just keep their names.
  void syncHost(environmentId)
    .catch(() => undefined)
    .finally(() => {
      running.delete(environmentId)
      if (rerun.delete(environmentId)) {
        requestSync(environmentId)
      }
    })
}

/** Keeps account names global: syncs each saved host on connect, on its account updates, and on local renames. */
export function useAccountNamesSync(): void {
  const idsKey = useAppStore(
    useShallow((s) => s.runtimeEnvironments.map((environment) => environment.id))
  ).join('|')
  const localNames = useAppStore((s) => s.settings?.accountNames)

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : []
    // Each published snapshot (connect, reconnect, a rename there) is a chance to converge.
    const unsubscribes = ids.map((id) =>
      subscribeOwnerAccounts(id, () => {
        if (readOwnerAccounts(id)?.failure !== 'unreachable') {
          requestSync(id)
        }
      })
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [idsKey])

  useEffect(() => {
    for (const id of idsKey ? idsKey.split('|') : []) {
      requestSync(id)
    }
  }, [idsKey, localNames])
}
