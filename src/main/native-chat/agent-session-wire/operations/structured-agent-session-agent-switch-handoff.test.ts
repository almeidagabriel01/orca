import { afterEach, expect, it } from 'vitest'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { ClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-router'
import { installClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import type { AgentSessionAgentSwitch } from '../../../runtime/agent-session/records/agent-session-agent-switch-record'
import { agentSwitchMarker } from './structured-agent-session-agent-switch-handoff'
import type { AccountNames } from '../../../../shared/agent-accounts/account-names'

const SAVED = { id: 'saved-b', email: 'b@example.com' }
const SYSTEM_EMAIL = 'system@example.com'

function installRouter(selected: string | null, names: AccountNames = {}): void {
  type Saved = ReturnType<ClaudeProfileRouter['savedAccount']>
  const router: Pick<
    ClaudeProfileRouter,
    'chosenProfile' | 'savedAccount' | 'systemDefaultLogin' | 'accountNames' | 'accountLogin'
  > = {
    accountNames: () => names,
    accountLogin: () => null,
    chosenProfile: (choice) => {
      const accountId = choice === undefined ? selected : choice === 'system' ? null : choice
      const target = { executionHostId: 'local', runtime: 'host' } as const
      return accountId ? { version: 1, accountId, target, home: `/h/${accountId}` } : null
    },
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the marker reads only email
    savedAccount: (id) => (id === SAVED.id ? ({ email: SAVED.email } as Saved) : undefined),
    systemDefaultLogin: () => ({
      email: SYSTEM_EMAIL,
      organizationUuid: null,
      organizationName: null
    })
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the marker calls only these five members
  installClaudeProfileRouter(router as ClaudeProfileRouter)
}

function mark(fromChoice: string | undefined, toChoice: string | null) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the marker reads only provider and accountChoice
  const from = { provider: 'claude', accountChoice: fromChoice } as AgentSessionRecord
  const change: AgentSessionAgentSwitch = {
    sessionId: 'chat',
    fence: 1,
    switchId: 'switch',
    kind: 'account',
    provider: 'claude',
    accountChoice: toChoice,
    now: 0
  }
  return agentSwitchMarker(from, change, null).agentSwitch
}

afterEach(() => installClaudeProfileRouter(undefined))

it('names the login on every side of an account switch, the system one included', () => {
  installRouter(null)
  expect(mark(SAVED.id, 'system')).toMatchObject({
    fromAccountLabel: 'b',
    toAccountLabel: 'system'
  })
  expect(mark('system', SAVED.id)).toMatchObject({
    fromAccountLabel: 'system',
    toAccountLabel: 'b'
  })
  // Following the host names whichever login the host has selected.
  expect(mark('system', null)?.toAccountLabel).toBe('system')
  installRouter(SAVED.id)
  expect(mark('system', null)?.toAccountLabel).toBe('b')
})

it("names each login by the user's name for it over its email", () => {
  // Names are keyed by login, so the saved account and System default each find theirs.
  installRouter(null, {
    [`claude:${SAVED.email}`]: { name: 'Work', updatedAt: 1 },
    [`claude:${SYSTEM_EMAIL}`]: { name: 'Home', updatedAt: 1 }
  })
  expect(mark(SAVED.id, 'system')).toMatchObject({
    fromAccountLabel: 'Work',
    toAccountLabel: 'Home'
  })
})
