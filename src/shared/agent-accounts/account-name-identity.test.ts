import { describe, expect, it } from 'vitest'
import {
  migrateLegacyAccountNames,
  planAccountNamesSync,
  withAccountNames
} from './account-name-identity'

const accounts = [
  { id: 'a1', identity: { email: 'Me@Work.example', organization: 'ORG-1' } },
  { id: 'a2', identity: { email: 'me@home.example' } }
]

describe('migrateLegacyAccountNames', () => {
  it('moves id-keyed names to identity entries stamped 0 and drops orphans', () => {
    const result = migrateLegacyAccountNames(
      undefined,
      { claude: { a1: 'Work', gone: 'Old', system: 'Personal' }, codex: { c1: 'Kept' } },
      'claude',
      accounts,
      { email: 'me@home.example' }
    )
    expect(result).toEqual({
      accountNames: {
        'claude:me@work.example#org-1': { name: 'Work', updatedAt: 0 },
        'claude:me@home.example': { name: 'Personal', updatedAt: 0 }
      },
      managedAccountDisplayNames: { claude: {}, codex: { c1: 'Kept' } }
    })
  })

  it('never overwrites an existing entry or tombstone', () => {
    const existing = { 'claude:me@home.example': { name: null, updatedAt: 5 } }
    const result = migrateLegacyAccountNames(
      existing,
      { claude: { a2: 'Home' } },
      'claude',
      accounts,
      {}
    )
    expect(result?.accountNames).toEqual(existing)
  })

  it("keeps System default's name until its login is readable", () => {
    expect(
      migrateLegacyAccountNames(undefined, { codex: { system: 'Me' } }, 'codex', [], {})
    ).toBeNull()
  })
})

describe('withAccountNames', () => {
  it('names saved rows and System default by login, sharing one name for one login', () => {
    const names = { 'codex:me@home.example': { name: 'Home', updatedAt: 1 } }
    const state: {
      accounts: { id: string; email: string; workspaceAccountId: null; displayName?: string }[]
      systemDefault: { email: string }
      systemDefaultDisplayName?: string
    } = {
      accounts: [{ id: 'c1', email: 'me@home.example', workspaceAccountId: null }],
      systemDefault: { email: 'ME@home.example' }
    }
    const named = withAccountNames(state, names, 'codex')
    expect(named.accounts[0].displayName).toBe('Home')
    expect(named.systemDefaultDisplayName).toBe('Home')
    expect(withAccountNames(named, names, 'codex')).toBe(named)
  })

  it('keeps a host-filled System default name when the state carries no login to key it', () => {
    const state = { accounts: [], systemDefaultDisplayName: 'Home' }
    const names = { 'claude:x@y': { name: 'X', updatedAt: 1 } }
    expect(withAccountNames(state, names, 'claude').systemDefaultDisplayName).toBe('Home')
  })
})

describe('planAccountNamesSync', () => {
  it('sends each side only what is newer on the other', () => {
    const local = {
      'claude:a@x': { name: 'A2', updatedAt: 20 },
      'claude:b@x': { name: 'B', updatedAt: 10 }
    }
    const remote = {
      'claude:a@x': { name: 'A1', updatedAt: 10 },
      'codex:c@x': { name: null, updatedAt: 30 }
    }
    expect(planAccountNamesSync(local, remote)).toEqual({
      toLocal: { 'codex:c@x': { name: null, updatedAt: 30 } },
      toRemote: {
        'claude:a@x': { name: 'A2', updatedAt: 20 },
        'claude:b@x': { name: 'B', updatedAt: 10 }
      }
    })
  })

  it('writes nothing for equal stamps, even when the names differ (two migrations)', () => {
    const local = { 'claude:a@x': { name: 'Mac', updatedAt: 0 } }
    const remote = { 'claude:a@x': { name: 'VPS', updatedAt: 0 } }
    expect(planAccountNamesSync(local, remote)).toEqual({ toLocal: null, toRemote: null })
    expect(planAccountNamesSync(undefined, {})).toEqual({ toLocal: null, toRemote: null })
  })
})
