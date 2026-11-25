import { expect, it } from 'vitest'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import {
  aiVaultSessionResumeLabel,
  resolveAiVaultHistorySessionResumeState
} from './ai-vault-session-resume'

// The VPS holds a copy synced from the Mac; the Mac (this client) has the recorded folder as a workspace.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const repos = [
  { id: 'repo-mac', connectionId: null },
  { id: 'repo-vps', connectionId: null, executionHostId: 'runtime:vps' }
] as unknown as Repo[]
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const macWorktree = {
  id: 'repo-mac::/Users/me/DEV/kit',
  repoId: 'repo-mac',
  path: '/Users/me/DEV/kit',
  displayName: 'kit'
} as Worktree
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const vpsWorktree = {
  id: 'repo-vps::/home/me/projects/kit',
  repoId: 'repo-vps',
  path: '/home/me/projects/kit',
  displayName: 'kit',
  hostId: 'runtime:vps'
} as unknown as Worktree
const worktrees = [macWorktree, vpsWorktree]
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const copy = {
  id: 'runtime:vps:claude:s1',
  agent: 'claude',
  sessionId: 's1',
  executionHostId: 'runtime:vps',
  cwd: '/Users/me/DEV/kit',
  cwdAliases: ['/home/me/projects/kit'],
  recordedOnOtherMachine: true,
  filePath: '/home/me/.claude/projects/-Users-me-DEV-kit/s1.jsonl',
  messageCount: 74,
  previewMessages: [],
  subagent: null
} as unknown as AiVaultSession
const holderInfo = {
  status: 'active' as const,
  label: 'kit',
  path: vpsWorktree.path,
  worktreeId: vpsWorktree.id
}

function resume(isHostOffline?: (hostId: string) => boolean) {
  return resolveAiVaultHistorySessionResumeState({
    session: copy,
    worktreeInfo: holderInfo,
    activeWorktreeId: vpsWorktree.id,
    worktrees,
    repos,
    hostLabel: (hostId) => (hostId === 'local' ? 'mac' : 'vps'),
    ...(isHostOffline ? { isHostOffline } : {})
  })
}

it('resumes a synced copy in the recording host workspace, never the copy holder', () => {
  const state = resume()
  expect(state).toMatchObject({
    blocked: false,
    worktreeId: macWorktree.id,
    usesSessionWorktree: true,
    originHostLabel: 'mac'
  })
  expect(aiVaultSessionResumeLabel(state)).toBe('Resume on mac')
})

it('blocks with an explanation while the recording host is offline', () => {
  const state = resume((hostId) => hostId === 'local')
  expect(state).toMatchObject({ blocked: true, worktreeId: null })
  expect(state.unavailableReason).toContain('mac')
})

it('blocks a copy whose recorded folder no other host holds', () => {
  const state = resolveAiVaultHistorySessionResumeState({
    session: copy,
    worktreeInfo: holderInfo,
    activeWorktreeId: vpsWorktree.id,
    worktrees: [vpsWorktree],
    repos
  })
  expect(state).toMatchObject({ blocked: true, worktreeId: null })
  expect(state.unavailableReason).toBeTruthy()
})
