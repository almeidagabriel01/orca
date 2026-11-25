import { describe, expect, it, vi } from 'vitest'
import type { AccountNames } from '../../shared/agent-accounts/account-names'
import { mergeStoredAccountNames, setStoredAccountName } from './stored-account-names'

function store(accountNames?: AccountNames) {
  let current = { accountNames }
  const updateSettings = vi.fn((patch: { accountNames: AccountNames }) => {
    current = { ...current, ...patch }
  })
  return { getSettings: () => current, updateSettings }
}

describe('stored account names', () => {
  it('names a login by identity, clears it to a tombstone, and skips no-op writes', () => {
    const names = store()
    expect(setStoredAccountName(names, 'antigravity', { email: 'Me@X.io' }, '  Work ')).toBe(true)
    expect(names.getSettings().accountNames?.['antigravity:me@x.io']?.name).toBe('Work')
    expect(setStoredAccountName(names, 'antigravity', { email: 'me@x.io' }, 'Work')).toBe(false)
    expect(setStoredAccountName(names, 'antigravity', { email: 'me@x.io' }, '')).toBe(true)
    expect(names.getSettings().accountNames?.['antigravity:me@x.io']?.name).toBeNull()
    expect(names.updateSettings).toHaveBeenCalledTimes(2)
    expect(setStoredAccountName(store(), 'claude', { email: 'a@x' }, null)).toBe(false)
  })

  it('refuses a login without an email', () => {
    expect(() => setStoredAccountName(store(), 'claude', { email: null }, 'x')).toThrow(/email/)
  })

  it('merges newest-wins and persists only when another host has something newer', () => {
    const names = store({
      'claude:a@x': { name: 'New', updatedAt: 20 },
      'claude:b@x': { name: 'B', updatedAt: 5 }
    })
    expect(
      mergeStoredAccountNames(names, {
        'claude:a@x': { name: 'Old', updatedAt: 10 },
        'claude:b@x': { name: null, updatedAt: 6 }
      })
    ).toBe(true)
    expect(names.getSettings().accountNames).toEqual({
      'claude:a@x': { name: 'New', updatedAt: 20 },
      'claude:b@x': { name: null, updatedAt: 6 }
    })
    expect(mergeStoredAccountNames(names, { 'claude:a@x': { name: 'Old', updatedAt: 10 } })).toBe(
      false
    )
    expect(names.updateSettings).toHaveBeenCalledTimes(1)
  })
})
