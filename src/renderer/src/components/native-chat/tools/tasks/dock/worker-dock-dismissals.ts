import { useSyncExternalStore } from 'react'
import { workerDockClearable } from '../../../../../../../shared/orchestration/dock/worker-dock'
import type { WorkerDockRowView } from './WorkerDockRow'

// Rows hidden from this machine's dock. Only the dock forgets them: transcripts, results and worktrees stay.
const STORAGE_KEY = 'orca.nativeChat.workerDock.dismissed'
const LIMIT = 1000
const EMPTY: ReadonlySet<string> = new Set()

type DismissCandidate = {
  state: WorkerDockRowView['state']
  settlement?: string | null
  ownerActionsAvailable?: boolean
  /** The provider reported this work settled, whatever state the strip draws it in. */
  finished?: boolean
}

/** Ended work this window may hide on its own; a failure the host acknowledges goes through Clear instead. */
export function workerDockLocallyDismissible(row: DismissCandidate): boolean {
  return (
    !workerDockClearable(row) &&
    (row.finished === true || row.state === 'failed' || row.state === 'unexpected')
  )
}

/** Drops the rows the user dismissed; one that came back to life (or ended again) shows again. */
export function withoutDismissedWorkerDockRows<T extends { dismissKey?: string }>(
  rows: readonly T[],
  dismissed: ReadonlySet<string>
): T[] {
  return rows.filter((row) => !row.dismissKey || !dismissed.has(row.dismissKey))
}

let dismissed: ReadonlySet<string> | null = null
const listeners = new Set<() => void>()

function read(): ReadonlySet<string> {
  if (dismissed) {
    return dismissed
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    dismissed = Array.isArray(saved)
      ? new Set(saved.filter((key): key is string => typeof key === 'string'))
      : EMPTY
  } catch {
    dismissed = EMPTY
  }
  return dismissed
}

export function dismissWorkerDockRows(keys: readonly string[]): void {
  if (!keys.length) {
    return
  }
  const next = [...read(), ...keys]
  dismissed = new Set(next.slice(Math.max(0, next.length - LIMIT)))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]))
  } catch {
    // Storage full or blocked: the rows stay hidden for this session.
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another window's dismissal lands in storage; re-read it so both windows hide the same rows.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      dismissed = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDismissedWorkerDockRows(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
