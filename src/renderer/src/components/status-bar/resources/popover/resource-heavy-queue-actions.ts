import { useCallback, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import type { HeavyQueueAction } from '../../../../../../shared/rpc-contract/diagnostics-params'

const ACTION_TIMEOUT_MS = 15_000

/** Sends a control to the host that runs the queue: this computer through IPC, a paired server through its RPC. */
function callHeavyQueueAction(hostId: string, action: HeavyQueueAction): Promise<unknown> {
  return hostId === 'local'
    ? window.api.memory.heavyQueueAction(action, { resourceManagerView: true })
    : callRuntimeRpc(
        { kind: 'environment', environmentId: hostId },
        'diagnostics.heavyQueueAction',
        action,
        { timeoutMs: ACTION_TIMEOUT_MS }
      )
}

/** One control at a time per host; the next queue sample shows its effect. */
export function useHeavyQueueActions(hostId: string): {
  run: (action: HeavyQueueAction, failure: (message: string) => string) => void
  pending: boolean
  error: string | null
} {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(
    (action: HeavyQueueAction, failure: (message: string) => string): void => {
      setPending(true)
      setError(null)
      void callHeavyQueueAction(hostId, action)
        .then(
          () => undefined,
          (cause: unknown) => setError(failure(extractIpcErrorMessage(cause, '')))
        )
        .finally(() => setPending(false))
    },
    [hostId]
  )
  return { run, pending, error }
}
