import { describe, expect, it } from 'vitest'
import { buildCodexStatusSwitchGroups } from './status-bar-codex-accounts'

const stamp = { createdAt: 0, updatedAt: 0, lastAuthenticatedAt: 0 }

describe('Codex status switcher rows', () => {
  it('shows nicknames without emails or System default', () => {
    const [host] = buildCodexStatusSwitchGroups(
      {
        accounts: [
          {
            id: 'ops',
            email: 'ops@example.com',
            displayName: 'Ops',
            managedHomeRuntime: 'host',
            ...stamp
          }
        ],
        activeAccountId: null,
        systemDefaultDisplayName: 'Pessoal'
      },
      { runtime: 'host', wslDistro: null }
    )
    expect(host.targets.map(({ name, detail, active }) => ({ name, detail, active }))).toEqual([
      { name: 'Pessoal', detail: null, active: true },
      { name: 'Ops', detail: null, active: false }
    ])
    const [unnamed] = buildCodexStatusSwitchGroups(
      { accounts: [], activeAccountId: null },
      { runtime: 'host', wslDistro: null }
    )
    expect(unnamed.targets[0]?.name).toBe("This computer's login")
  })
})
