import { expect, it } from 'vitest'
import type { AiVaultSession } from '../contracts/ai-vault-types'
import {
  resolveAiVaultSessionWorktreeInfo,
  type AiVaultSessionOwnerWorkspace
} from './ai-vault-session-worktree'

const repos = [
  { id: 'repo-mac', connectionId: null },
  { id: 'repo-vps', connectionId: null, executionHostId: 'runtime:vps' },
  { id: 'repo-other', connectionId: null, executionHostId: 'runtime:vps' }
]
const workspace = (
  id: string,
  repoId: string,
  path: string,
  branch: string,
  isMainWorktree: boolean
): AiVaultSessionOwnerWorkspace => ({ id, repoId, path, displayName: id, branch, isMainWorktree })
const macMain = workspace('mac-main', 'repo-mac', '/Users/me/DEV/App', 'refs/heads/feat/x', true)
const vpsMain = workspace(
  'vps-main',
  'repo-vps',
  '/home/me/projects/App',
  'refs/heads/develop',
  true
)
const vpsFeature = workspace(
  'vps-feature',
  'repo-vps',
  '/home/me/workspaces/App/feature',
  'refs/heads/feat/x',
  false
)
const otherMain = workspace('other-main', 'repo-other', '/home/me/projects/Other', 'develop', true)
const worktrees = [macMain, otherMain, vpsMain, vpsFeature]

function route(cwd: string, branch: string | null): string | undefined {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
  const session = { executionHostId: 'runtime:vps', cwd, branch } as unknown as AiVaultSession
  return resolveAiVaultSessionWorktreeInfo({
    session,
    worktrees,
    repos,
    activeWorktreeId: macMain.id
  })?.worktreeId
}

it('routes a session to its host by cwd, then the project branch, then the main checkout', () => {
  expect(route('/home/me/projects/App', 'feat/x')).toBe('vps-main')
  // A worktree that is not an Orca workspace (hidden, discovered) falls back on its own host only.
  expect(route('/home/me/workspaces/App/hidden', 'feat/x')).toBe('vps-feature')
  expect(route('/home/me/workspaces/App/hidden', 'claude/unknown')).toBe('vps-main')
  expect(route('/home/me/workspaces/Unrelated/hidden', 'develop')).toBeUndefined()
})
