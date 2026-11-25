import { describe, expect, it } from 'vitest'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { ProjectHostSetupOption } from '@/lib/workspace/creation/project-host-setup-options'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { buildHandoffDestinations, type HandoffDestinationInput } from './handoff-destinations'

const ready = (hostId: ExecutionHostId, repoId: string): ProjectHostSetupOption => ({
  id: `setup-${hostId}`,
  kind: 'ready',
  projectId: 'p',
  hostId,
  repoId,
  label: hostId,
  detail: 'repo',
  path: `/${hostId}/repo`
})
const needsSetup = (hostId: ExecutionHostId): ProjectHostSetupOption => ({
  id: `needs-setup:${hostId}`,
  kind: 'needs-setup',
  projectId: 'p',
  hostId,
  label: hostId,
  detail: 'Not set up here',
  isAvailable: true,
  attention: false,
  canSetLocation: true
})
const wt = (id: string, repoId: string, branch: string, hostId?: ExecutionHostId) =>
  makeWorktree({ id, repoId, branch, hostId, path: `/p/${id}`, displayName: id })

function build(overrides: Partial<HandoffDestinationInput>) {
  return buildHandoffDestinations({
    source: { id: 'src', path: '/local/src', branch: 'refs/heads/feat/x', displayName: 'src' },
    sourceHostId: 'local',
    sourceIsFolder: false,
    hostOptions: [ready('local', 'r1'), ready('runtime:mac', 'r1')],
    hosts: [
      { id: 'local', kind: 'local', health: 'available' },
      { id: 'runtime:mac', kind: 'runtime', health: 'available' },
      { id: 'ssh:box', kind: 'ssh', health: 'available' }
    ],
    worktreesByRepo: { r1: [wt('src', 'r1', 'refs/heads/feat/x', 'local')] },
    hostUnavailableDetail: (host) => (host.health === 'disconnected' ? 'Connect this host' : null),
    ...overrides
  })
}

describe('buildHandoffDestinations', () => {
  it('matches the same branch on the other host even when branch formats differ', () => {
    const rows = build({
      worktreesByRepo: {
        r1: [
          wt('src', 'r1', 'refs/heads/feat/x', 'local'),
          wt('twin', 'r1', 'feat/x', 'runtime:mac')
        ]
      }
    })
    expect(rows.map((row) => [row.kind, row.worktreeId, row.block])).toEqual([
      ['current', 'src', null],
      ['same-branch', 'twin', null]
    ])
  })

  it('does not match a same-repo worktree owned by another host', () => {
    const rows = build({
      worktreesByRepo: {
        r1: [wt('src', 'r1', 'feat/x', 'local'), wt('other', 'r1', 'feat/x', 'runtime:else')]
      }
    })
    expect(rows[1]).toMatchObject({ worktreeId: null, block: { kind: 'branch-missing' } })
  })

  it('names the destination host repo on a missing branch so it can be created there', () => {
    const rows = build({ hostOptions: [ready('local', 'r1'), ready('runtime:mac', 'r2')] })
    expect(rows[1].block).toEqual({ kind: 'branch-missing', repoId: 'r2' })
  })

  it('blocks with the host detail when the host is disconnected', () => {
    const rows = build({
      hosts: [
        { id: 'local', kind: 'local', health: 'available' },
        { id: 'runtime:mac', kind: 'runtime', health: 'disconnected' }
      ],
      worktreesByRepo: { r1: [wt('twin', 'r1', 'feat/x', 'runtime:mac')] }
    })
    expect(rows[1].block).toEqual({ kind: 'host-unavailable', detail: 'Connect this host' })
  })

  it('reports a missing project, omits ssh hosts, and flags detached sources', () => {
    const rows = build({
      hostOptions: [ready('local', 'r1'), needsSetup('runtime:mac'), needsSetup('ssh:box')]
    })
    expect(rows).toHaveLength(2)
    expect(rows[1].block).toEqual({ kind: 'project-missing', detail: 'Not set up here' })

    const detached = build({
      source: { id: 'src', path: '/local/src', branch: '', displayName: 'src' }
    })
    expect(detached[1].block).toEqual({ kind: 'detached-source' })
  })
})
