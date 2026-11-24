import { afterEach, expect, it } from 'vitest'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { ClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-router'
import { installClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-installed-router'
import type { AgentSessionAgentSwitch } from '../../../runtime/agent-session/records/agent-session-agent-switch-record'
import { agentSwitchMarker } from './structured-agent-session-agent-switch-handoff'

const SAVED = { id: 'saved-b', email: 'b@example.com' }
const SYSTEM_EMAIL = 'system@example.com'

function installRouter(selected: string | null): void {
  type Saved = ReturnType<ClaudeProfileRouter['savedAccount']>
  const router: Pick<ClaudeProfileRouter, 'chosenProfile' | 'savedAccount' | 'systemDefaultLogin'> =
    {
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
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the marker calls only these three members
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
    fromAccountLabel: SAVED.email,
    toAccountLabel: SYSTEM_EMAIL
  })
  expect(mark('system', SAVED.id)).toMatchObject({
    fromAccountLabel: SYSTEM_EMAIL,
    toAccountLabel: SAVED.email
  })
  // Following the host names whichever login the host has selected.
  expect(mark('system', null)?.toAccountLabel).toBe(SYSTEM_EMAIL)
  installRouter(SAVED.id)
  expect(mark('system', null)?.toAccountLabel).toBe(SAVED.email)
})
