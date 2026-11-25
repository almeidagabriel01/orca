import { describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../../shared/settings/global-settings-types'
import type { CodexSystemDefaultIdentity } from '../../../shared/agent-accounts/managed-account-types'
import { CodexAccountSelection } from './codex-account-selection'

function selectionWith(systemDefault: CodexSystemDefaultIdentity) {
  let settings: Partial<GlobalSettings> = {
    codexManagedAccounts: [],
    activeCodexManagedAccountId: null,
    managedAccountDisplayNames: { codex: { system: 'Old' } }
  }
  const store = {
    getSettings: () => settings,
    updateSettings: (patch: Partial<GlobalSettings>) => {
      settings = { ...settings, ...patch }
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: rename and snapshot reach only the store and the system login
  const dependencies = {
    store,
    resolveSystemDefault: async () => systemDefault
  } as unknown as ConstructorParameters<typeof CodexAccountSelection>[0]
  return { selection: new CodexAccountSelection(dependencies), settings: () => settings }
}

const login = (email: string | null): CodexSystemDefaultIdentity => ({
  hasAuth: true,
  authKind: 'oauth',
  email,
  providerAccountId: null,
  workspaceLabel: null,
  workspaceAccountId: 'WS-1'
})

describe('Codex System default names', () => {
  it('migrates the old name, then renames by the system login and its workspace', async () => {
    const { selection, settings } = selectionWith(login('me@x.io'))
    expect((await selection.snapshot()).systemDefaultDisplayName).toBe('Old')
    const renamed = await selection.rename('system', 'Mine')
    expect(renamed.systemDefaultDisplayName).toBe('Mine')
    expect(settings().accountNames?.['codex:me@x.io#ws-1']?.name).toBe('Mine')
    expect(settings().managedAccountDisplayNames).toEqual({ codex: {} })
  })

  it('refuses when the system login has no email', async () => {
    const { selection } = selectionWith(login(null))
    await expect(selection.rename('system', 'x')).rejects.toThrow(/email/)
  })
})
