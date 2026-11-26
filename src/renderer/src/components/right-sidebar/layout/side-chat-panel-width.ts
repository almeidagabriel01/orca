import { useSyncExternalStore } from 'react'

export const SIDE_CHAT_PANEL_MIN_WIDTH = 360
export const SIDE_CHAT_PANEL_DEFAULT_WIDTH = 480
const STORAGE_KEY = 'orca.rightSidebar.sideChatWidth'

const listeners = new Set<() => void>()

function readStoredWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : SIDE_CHAT_PANEL_DEFAULT_WIDTH
  } catch {
    return SIDE_CHAT_PANEL_DEFAULT_WIDTH
  }
}

let width = readStoredWidth()

// ponytail: kept in localStorage, outside the persisted-UI profile; move into it if it must follow profiles or WSL moves.
export function setSideChatPanelWidth(next: number): void {
  if (next === width) {
    return
  }
  width = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // Storage can be unavailable (private web sessions); the width still holds for this window.
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The side chat's own panel width, so the other tabs keep theirs. */
export function useSideChatPanelWidth(): number {
  return useSyncExternalStore(subscribe, () => width)
}
