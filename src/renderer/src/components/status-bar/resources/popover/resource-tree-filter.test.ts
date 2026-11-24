import { describe, expect, it } from 'vitest'
import type {
  UnifiedProjectGroup,
  UnifiedWorktreeRow
} from '../workspace-attribution/resource-usage-merge-types'
import { filterProjectGroups } from './resource-tree-filter'

const worktree = (name: string, fields: Partial<UnifiedWorktreeRow> = {}): UnifiedWorktreeRow => ({
  worktreeId: `id-${name}`,
  worktreeName: name,
  repoId: 'r',
  repoName: 'r',
  cpu: 0,
  memory: 0,
  history: [],
  hasLocalSamples: true,
  isRemote: false,
  sessions: [],
  browsers: [],
  ...fields
})

const group = (repoName: string, worktrees: UnifiedWorktreeRow[]): UnifiedProjectGroup => ({
  repoId: repoName,
  repoName,
  cpu: 0,
  memory: 0,
  hasRemoteChildren: false,
  worktrees
})

const groups = [
  group('orca', [worktree('hydra'), worktree('snakehead')]),
  group('shop', [
    worktree('porpoise', {
      sessions: [
        {
          sessionId: 's',
          paneKey: null,
          pid: 1,
          label: 'Codex checkout',
          bound: true,
          agentOwnership: 'absent',
          tabId: null,
          cpu: 0,
          memory: 0,
          hasLocalSamples: true
        }
      ]
    }),
    worktree('tarpon', {
      chats: [{ agentSessionId: 'c', agent: 'claude', name: 'Billing', cpu: 0, memory: 0 }]
    })
  ])
]

const names = (result: UnifiedProjectGroup[]): string[] =>
  result.flatMap((g) => g.worktrees.map((w) => `${g.repoName}/${w.worktreeName}`))

describe('filterProjectGroups', () => {
  it('keeps everything for a blank query', () => {
    expect(names(filterProjectGroups(groups, '  '))).toHaveLength(4)
  })
  it('keeps a whole project when its name matches', () => {
    expect(names(filterProjectGroups(groups, 'ORC'))).toEqual(['orca/hydra', 'orca/snakehead'])
  })
  it('keeps only matching workspaces, by name, terminal or chat', () => {
    expect(names(filterProjectGroups(groups, 'snake'))).toEqual(['orca/snakehead'])
    expect(names(filterProjectGroups(groups, 'checkout'))).toEqual(['shop/porpoise'])
    expect(names(filterProjectGroups(groups, 'billing'))).toEqual(['shop/tarpon'])
  })
  it('matches the display name the sidebar shows', () => {
    const label = (id: string): string | undefined => (id === 'id-hydra' ? 'Login fix' : undefined)
    expect(names(filterProjectGroups(groups, 'login', label))).toEqual(['orca/hydra'])
  })
  it('drops projects with nothing left', () => {
    expect(filterProjectGroups(groups, 'zzz')).toEqual([])
  })
})
