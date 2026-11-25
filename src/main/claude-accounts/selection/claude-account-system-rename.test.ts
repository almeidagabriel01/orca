import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ClaudeAccountSelection,
  type ClaudeAccountRuntime,
  type ClaudeAccountSettings,
  type ClaudeAccountUsage
} from './claude-account-selection'

function systemLoginDir(email?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-system-name-'))
  if (email) {
    writeFileSync(
      join(dir, '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: email, organizationUuid: 'org-1' } })
    )
  }
  return dir
}

function selectionWith(
  settings: ClaudeAccountSettings,
  configDir: string
): { selection: ClaudeAccountSelection; settings: () => ClaudeAccountSettings } {
  let current = settings
  const store = {
    getSettings: () => current,
    updateSettings: (patch: Partial<ClaudeAccountSettings>) => {
      current = { ...current, ...patch }
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: rename and list only reach these router reads
  const runtime = {
    router: {
      userConfigDir: () => configDir,
      systemDefaultHome: () => configDir,
      copiedLoginIntoSystemDefault: () => false
    }
  } as unknown as ClaudeAccountRuntime
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: System default renames never read usage
    selection: new ClaudeAccountSelection(store, {} as ClaudeAccountUsage, runtime),
    settings: () => current
  }
}

const EMPTY: ClaudeAccountSettings = {
  claudeManagedAccounts: [],
  activeClaudeManagedAccountId: null,
  activeClaudeManagedAccountIdsByRuntime: undefined
}

describe('System default names', () => {
  it("names System default by its login's identity and clears it on blank", () => {
    const { selection, settings } = selectionWith(EMPTY, systemLoginDir('Me@Home.example'))

    expect(selection.rename('system', '  Personal  ').systemDefaultDisplayName).toBe('Personal')
    expect(settings().accountNames).toEqual({
      'claude:me@home.example#org-1': { name: 'Personal', updatedAt: expect.any(Number) }
    })

    const cleared = selection.rename('system', '')
    expect(cleared.systemDefaultDisplayName).toBeUndefined()
    expect(settings().accountNames?.['claude:me@home.example#org-1']?.name).toBeNull()
  })

  it('refuses to name a System default with no readable email', () => {
    const { selection } = selectionWith(EMPTY, systemLoginDir())
    expect(() => selection.rename('system', 'x')).toThrow(/email/)
  })

  it('migrates an old System default name once its login is readable', () => {
    const { selection, settings } = selectionWith(
      { ...EMPTY, managedAccountDisplayNames: { claude: { system: 'Old' } } },
      systemLoginDir('me@home.example')
    )
    expect(selection.list().systemDefaultDisplayName).toBe('Old')
    expect(settings().accountNames).toEqual({
      'claude:me@home.example#org-1': { name: 'Old', updatedAt: 0 }
    })
    expect(settings().managedAccountDisplayNames).toEqual({ claude: {} })
  })

  it('still refuses an unknown saved account id', () => {
    const { selection } = selectionWith(EMPTY, systemLoginDir('me@home.example'))
    expect(() => selection.rename('not-an-account', 'x')).toThrow()
  })
})
