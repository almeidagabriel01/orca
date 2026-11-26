import { expect, it } from 'vitest'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { buildHandoffDestinations } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import {
  resolveAiVaultSessionHostActions,
  resolveAiVaultSessionHostOrigin
} from './ai-vault-session-host-actions'
import {
  resolveAiVaultHistorySessionResumeState,
  resolveAiVaultSessionResumeActions
} from './ai-vault-session-resume'

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
  displayName: 'kit',
  branch: 'refs/heads/main'
} as Worktree
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const vpsWorktree = {
  id: 'repo-vps::/home/me/projects/kit',
  repoId: 'repo-vps',
  path: '/home/me/projects/kit',
  displayName: 'kit',
  hostId: 'runtime:vps',
  branch: 'refs/heads/main'
} as unknown as Worktree
const worktrees = [macWorktree, vpsWorktree]
// The Mac's own row of a conversation recorded there.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const own = {
  id: 'local:claude:s1',
  agent: 'claude',
  sessionId: 's1',
  executionHostId: 'local',
  cwd: '/Users/me/DEV/kit',
  filePath: '/Users/me/.claude/projects/-Users-me-DEV-kit/s1.jsonl',
  messageCount: 74,
  previewMessages: [{ role: 'user', text: 'Push the branch.', timestamp: null }],
  subagent: null
} as unknown as AiVaultSession
// The same conversation as the VPS's synced copy.
const copy = {
  ...own,
  id: 'runtime:vps:claude:s1',
  executionHostId: 'runtime:vps',
  cwdAliases: [vpsWorktree.path],
  recordedOnOtherMachine: true,
  filePath: '/home/me/.claude/projects/-Users-me-DEV-kit/s1.jsonl'
} as AiVaultSession
const hostLabel = (hostId: string): string => (hostId === 'local' ? 'Local Mac' : 'vps')

function hostActions(session: AiVaultSession, worktreeInfo: { path: string; worktreeId: string }) {
  const args = {
    session,
    worktreeInfo: { status: 'active' as const, label: 'kit', ...worktreeInfo },
    activeWorktreeId: null,
    worktrees,
    repos
  }
  const state = resolveAiVaultHistorySessionResumeState({ ...args, hostLabel })
  // As the panel does: a copy resumes only in its recording host's workspace.
  const actions = session.recordedOnOtherMachine
    ? {
        worktree: { worktreeId: state.worktreeId, disabled: state.blocked },
        newTab: { worktreeId: null, disabled: true }
      }
    : resolveAiVaultSessionResumeActions({
        ...args,
        sessionFilePath: session.filePath,
        sessionExecutionHostId: session.executionHostId
      })
  const origin = resolveAiVaultSessionHostOrigin(session, state, actions)
  const source = worktrees.find((worktree) => worktree.id === origin.worktreeId)
  const destinations = source
    ? buildHandoffDestinations({
        source,
        sourceHostId: origin.hostId,
        sourceIsFolder: false,
        hostOptions: [
          {
            kind: 'ready',
            id: 'mac',
            projectId: 'kit',
            hostId: 'local',
            label: 'Local Mac',
            detail: '',
            repoId: 'repo-mac',
            path: macWorktree.path
          },
          {
            kind: 'ready',
            id: 'vps',
            projectId: 'kit',
            hostId: 'runtime:vps',
            label: 'vps',
            detail: '',
            repoId: 'repo-vps',
            path: vpsWorktree.path
          }
        ],
        hosts: [],
        worktreesByRepo: { 'repo-mac': [macWorktree], 'repo-vps': [vpsWorktree] },
        hostUnavailableDetail: () => null
      })
    : null
  return {
    origin,
    actions: resolveAiVaultSessionHostActions({
      session,
      origin,
      destinations,
      openElsewhere: false
    })
  }
}

it('offers the same host row for a conversation and its synced copy: resume where recorded, continue elsewhere', () => {
  const fromOwnRow = hostActions(own, { path: macWorktree.path, worktreeId: macWorktree.id })
  const fromCopy = hostActions(copy, { path: vpsWorktree.path, worktreeId: vpsWorktree.id })
  expect(fromOwnRow.origin).toMatchObject({ hostId: 'local', worktreeId: macWorktree.id })
  expect(fromCopy.origin).toMatchObject({ hostId: 'local', worktreeId: macWorktree.id })
  const expected = [
    { kind: 'resume', hostLabel: 'Local Mac', disabledReason: null },
    { kind: 'continue', key: 'host:runtime:vps', hostLabel: 'vps', disabledReason: null }
  ]
  expect(fromOwnRow.actions).toMatchObject(expected)
  expect(fromCopy.actions).toMatchObject(expected)
})
