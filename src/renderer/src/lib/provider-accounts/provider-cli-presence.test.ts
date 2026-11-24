import { expect, it } from 'vitest'
import { agentCliInstalled, providerSignInState } from './provider-cli-presence'

it('treats a missing sign-in as an error only where the CLI is installed', () => {
  const withCodex = agentCliInstalled(['claude', 'codex'], false, 'codex')
  const withoutCodex = agentCliInstalled(['claude'], false, 'codex')
  const loading = agentCliInstalled(null, false, 'codex')
  const probeFailed = agentCliInstalled(null, true, 'codex')

  expect(providerSignInState(withCodex, false)).toBe('ready')
  expect(providerSignInState(withCodex, true)).toBe('needs-sign-in')
  expect(providerSignInState(withoutCodex, true)).toBe('not-installed')
  expect(providerSignInState(withoutCodex, false)).toBe('not-installed')
  expect(providerSignInState(loading, true)).toBe('ready')
  expect(providerSignInState(probeFailed, true)).toBe('needs-sign-in')
})
