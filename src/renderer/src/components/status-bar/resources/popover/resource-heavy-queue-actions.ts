import { useCallback, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import type { HeavyQueueAction } from '../../../../../../shared/rpc-contract/diagnostics-params'

const ACTION_TIMEOUT_MS = 15_000

/** Sends a control to the host that runs the queue: this computer through IPC, a paired server through its RPC. */
export function callHeavyQueueAction(hostId: string, action: HeavyQueueAction): Promise<unknown> {
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
  /** Any multi-step control (a move to another host); shares the pending state and error line. */
  runTask: (task: () => Promise<unknown>, failure: (message: string) => string) => void
  pending: boolean
  error: string | null
} {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runTask = useCallback(
    (task: () => Promise<unknown>, failure: (message: string) => string): void => {
      setPending(true)
      setError(null)
      void task()
        .then(
          () => undefined,
          (cause: unknown) => setError(failure(extractIpcErrorMessage(cause, '')))
        )
        .finally(() => setPending(false))
    },
    []
  )
  const run = useCallback(
    (action: HeavyQueueAction, failure: (message: string) => string): void =>
      runTask(() => callHeavyQueueAction(hostId, action), failure),
    [hostId, runTask]
  )
  return { run, runTask, pending, error }
}
