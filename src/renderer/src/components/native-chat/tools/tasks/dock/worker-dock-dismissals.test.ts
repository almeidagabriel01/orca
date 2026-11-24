// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  dismissWorkerDockRows,
  restoreWorkerDockRows,
  useDismissedWorkerDockRows,
  withoutDismissedWorkerDockRows,
  workerDockLocallyDismissible
} from './worker-dock-dismissals'
import { workerDockSummary } from './worker-dock-summary'

const t = ((_key: string, fallback: string, options?: { count?: number }) =>
  fallback.replace('{{count}}', String(options?.count ?? ''))) as never

describe('workerDockLocallyDismissible', () => {
  it('never hides live work, and leaves acknowledgeable failures to Clear', () => {
    for (const state of [
      'starting',
      'running',
      'stopping',
      'saving',
      'needs-you',
      'coordinator',
      'waiting',
      'idle',
      'unavailable'
    ] as const) {
      expect(workerDockLocallyDismissible({ state })).toBe(false)
    }
    expect(workerDockLocallyDismissible({ state: 'failed', settlement: 's1' })).toBe(false)
    expect(workerDockLocallyDismissible({ state: 'failed', settlement: null })).toBe(true)
    expect(
      workerDockLocallyDismissible({
        state: 'unexpected',
        settlement: 's1',
        ownerActionsAvailable: false
      })
    ).toBe(true)
    expect(workerDockLocallyDismissible({ state: 'running', finished: true })).toBe(true)
  })
})

describe('withoutDismissedWorkerDockRows', () => {
  it('drops dismissed rows from the list and the header count, never rows with no key', () => {
    const rows = [
      { id: 'a', state: 'running' as const },
      { id: 'b', state: 'failed' as const, dismissKey: 'b\0s1' },
      { id: 'c', state: 'failed' as const, dismissKey: 'c\0s2' },
      { id: 'd', state: 'running' as const, dismissKey: undefined }
    ]
    const shown = withoutDismissedWorkerDockRows(rows, new Set(['b\0s1', 'd\0']))
    expect(shown.map((row) => row.id)).toEqual(['a', 'c', 'd'])
    expect(workerDockSummary(shown, new Map(), t).count).toBe('3 workers · 1 failed')
  })
})

it('Undo brings dismissed rows back, in storage too, and keeps the others hidden', () => {
  const { result } = renderHook(() => useDismissedWorkerDockRows())
  act(() => dismissWorkerDockRows(['a', 'b', 'c']))
  act(() => restoreWorkerDockRows(['a', 'b']))
  expect([...result.current]).toEqual(['c'])
  expect(JSON.parse(localStorage.getItem('orca.nativeChat.workerDock.dismissed') ?? '[]')).toEqual([
    'c'
  ])
})
