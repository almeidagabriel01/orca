import { describe, expect, it } from 'vitest'
import { accountNameToSave, withRenamedAccount } from './account-rename-runner'

describe('inline account names', () => {
  it('saves only a changed name, and blank clears a saved one', () => {
    expect(accountNameToSave('  Work ', 'Work')).toBeNull()
    expect(accountNameToSave('', undefined)).toBeNull()
    expect(accountNameToSave(' Home ', 'Work')).toBe('Home')
    expect(accountNameToSave('   ', 'Work')).toBe('')
  })

  it("applies a System default rename from the host's reply", () => {
    const current = { accounts: [{ id: 'a1', displayName: 'Work' }] }
    const named = withRenamedAccount(
      current,
      { accounts: [], systemDefaultDisplayName: 'Mine' },
      'system'
    )
    expect(named).toEqual({ accounts: current.accounts, systemDefaultDisplayName: 'Mine' })
    expect(withRenamedAccount(named, { accounts: [] }, 'system')).toEqual(current)
  })
})
