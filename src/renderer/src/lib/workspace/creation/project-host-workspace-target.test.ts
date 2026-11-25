import { describe, expect, it } from 'vitest'
import type { Project, ProjectHostSetup } from '../../../../../shared/project/project-types'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { resolveWorkspaceCreationTarget } from './project-host-workspace-target'

const VPS = 'runtime:vps' as const

function repo(id: string, executionHostId: Repo['executionHostId']): Repo {
  return { id, path: `/src/${id}`, displayName: 'app', badgeColor: '', addedAt: 0, executionHostId }
}

function setup(id: string, repoId: string, hostId: ProjectHostSetup['hostId']): ProjectHostSetup {
  return {
    id,
    projectId: 'p',
    hostId,
    repoId,
    path: `/src/${repoId}`,
    displayName: 'app',
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 0,
    updatedAt: 0
  }
}

const base = {
  eligibleRepos: [repo('mac-repo', 'local'), repo('vps-repo', VPS)],
  projects: [{ id: 'p', sourceRepoIds: [] } as unknown as Project],
  projectHostSetups: [setup('s-mac', 'mac-repo', 'local'), setup('s-vps', 'vps-repo', VPS)],
  projectRunHostIds: { p: VPS }
}

function hostOf(input: Parameters<typeof resolveWorkspaceCreationTarget>[0]): string | null {
  const resolution = resolveWorkspaceCreationTarget(input)
  return resolution.status === 'ready' ? resolution.target.hostId : null
}

describe('resolveWorkspaceCreationTarget run-on preference', () => {
  it('sends a seeded repo (sidebar +, palette) to the preferred host', () => {
    expect(hostOf({ ...base, initialRepoId: 'mac-repo' })).toBe(VPS)
    expect(hostOf({ ...base, activeRepoId: 'mac-repo', focusedHostScope: 'local' })).toBe(VPS)
  })

  it('keeps a repo picked in the dialog and explicit host picks', () => {
    expect(hostOf({ ...base, draftRepoId: 'mac-repo' })).toBe('local')
    expect(hostOf({ ...base, projectId: 'p', hostId: 'local' })).toBe('local')
    expect(hostOf({ ...base, projectHostSetupId: 's-mac' })).toBe('local')
  })

  it('beats the focused host scope when only the project is named', () => {
    expect(hostOf({ ...base, projectId: 'p', focusedHostScope: 'local' })).toBe(VPS)
  })

  it('falls through when the preferred host is unreachable or stale', () => {
    const actionableHostIds = new Set(['local'] as const)
    expect(hostOf({ ...base, initialRepoId: 'mac-repo', actionableHostIds })).toBe('local')
    expect(hostOf({ ...base, projectId: 'p', projectRunHostIds: { p: 'ssh:gone' } })).toBe('local')
  })

  it('uses the global default when the project has none, and the project value over it', () => {
    const { projectRunHostIds: _unset, ...noProject } = base
    const input = { ...noProject, projectId: 'p', focusedHostScope: 'local' as const }
    expect(hostOf({ ...input, heavyRunHostDefault: VPS })).toBe(VPS)
    expect(hostOf({ ...noProject, initialRepoId: 'mac-repo', heavyRunHostDefault: VPS })).toBe(VPS)
    expect(hostOf({ ...input, heavyRunHostDefault: null })).toBe('local')
    expect(hostOf({ ...input, projectRunHostIds: { p: 'local' }, heavyRunHostDefault: VPS })).toBe(
      'local'
    )
  })

  it('falls back to the global default when the project host lacks the project', () => {
    expect(
      hostOf({
        ...base,
        projectId: 'p',
        projectRunHostIds: { p: 'ssh:gone' },
        heavyRunHostDefault: VPS,
        focusedHostScope: 'local'
      })
    ).toBe(VPS)
  })
})
