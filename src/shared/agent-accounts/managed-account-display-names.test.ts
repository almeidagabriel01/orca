import { expect, it } from 'vitest'
import { getAccountDisplayName, getSystemDefaultDisplayName } from './managed-account-display-names'
import { getCodexAccountDisplayLabel } from './codex-account-display-label'

it('names an account by its nickname, else the email local part', () => {
  expect(getAccountDisplayName({ displayName: ' Work ', email: 'gestao@x.com' })).toBe('Work')
  expect(getAccountDisplayName({ displayName: '  ', email: 'gestao@x.com' })).toBe('gestao')
  expect(getAccountDisplayName({ email: '' })).toBeUndefined()
})

it('names System default by its nickname, else the host login local part, for Claude and Codex', () => {
  expect(
    getSystemDefaultDisplayName({
      systemDefaultDisplayName: 'Home',
      systemDefaultEmail: 'me@x.com'
    })
  ).toBe('Home')
  expect(getSystemDefaultDisplayName({ systemDefaultEmail: 'me@x.com' })).toBe('me')
  expect(getSystemDefaultDisplayName({ systemDefault: { email: 'cx@y.com' } })).toBe('cx')
  expect(getSystemDefaultDisplayName({})).toBeUndefined()
})

it('labels a Codex account by name and adds workspace or id only when another shares its email', () => {
  const a = { id: 'aaaaaaaa1', email: 'me@x.com', workspaceLabel: 'Team' }
  const b = { id: 'bbbbbbbb2', email: 'ME@x.com', workspaceLabel: 'Solo', displayName: 'Side' }
  const c = { id: 'cccccccc3', email: 'other@x.com', workspaceLabel: 'Team' }
  expect(getCodexAccountDisplayLabel(c, [a, b, c])).toBe('other')
  expect(getCodexAccountDisplayLabel(a, [a, b, c])).toBe('me (Team)')
  expect(getCodexAccountDisplayLabel(b, [a, b, c])).toBe('Side (Solo)')
})
