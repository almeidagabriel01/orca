// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store/index'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import { resolveHandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import type { ProjectHostSetup } from '../../../../shared/project/project-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useHandoffDestinations } from './use-handoff-destinations'

// Ids as `orca worktree list` / `environment list` report them on the paired Mac and VPS.
const ENV = '5e25cc32-3df7-46bd-bcf8-0268d9b6e166'
const VPS = `runtime:${ENV}` as const
const PROJECT = 'github:pingdotgg/t3code'
const macRepo: Repo = {
  id: '9b912da6-5868-4d7e-89a7-bef173f8b93a',
  path: '/Users/me/DEV/Pessoal/t3code',
  displayName: 't3code',
  badgeColor: '',
  addedAt: 1
}
const vpsRepo: Repo = {
  id: '06f9be1b-9595-4c16-b472-418cf5ba135c',
  path: '/home/me/projects/pessoal/t3code',
  displayName: 't3code',
  badgeColor: '',
  addedAt: 1,
  executionHostId: VPS
}
const macMain = makeWorktree({
  id: `${macRepo.id}::${macRepo.path}`,
  repoId: macRepo.id,
  projectId: PROJECT,
  hostId: 'local',
  path: macRepo.path,
  branch: 'refs/heads/main',
  isMainWorktree: true,
  displayName: 't3code'
})
function setup(id: string, hostId: ProjectHostSetup['hostId'], repo: Repo): ProjectHostSetup {
  return {
    id,
    projectId: PROJECT,
    hostId,
    repoId: repo.id,
    path: repo.path,
    displayName: 't3code',
    executionHostId: hostId,
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1
  }
}

function seed(vpsMain: Worktree, extra: Record<string, unknown> = {}): void {
  useAppStore.setState({
    settings: getDefaultSettings('/home/me'),
    repos: [macRepo, vpsRepo],
    projectHostSetups: [setup(macRepo.id, 'local', macRepo), setup(vpsRepo.id, VPS, vpsRepo)],
    worktreesByRepo: { [macRepo.id]: [macMain], [vpsRepo.id]: [vpsMain] },
    runtimeEnvironments: [
      {
        id: ENV,
        name: 'vps',
        createdAt: 1,
        updatedAt: 1,
        lastUsedAt: null,
        runtimeId: null,
        endpoints: [],
        preferredEndpointId: null
      }
    ],
    runtimeStatusByEnvironmentId: new Map([
      [ENV, { status: createCompatibleRuntimeStatusResponse(ENV).result, checkedAt: 1 }]
    ]),
    ...extra
  } as never)
}

const vpsByHostId = makeWorktree({
  id: `${vpsRepo.id}::${vpsRepo.path}`,
  repoId: vpsRepo.id,
  hostId: VPS,
  path: vpsRepo.path,
  branch: 'refs/heads/main',
  isMainWorktree: true,
  displayName: 't3code'
})
const vpsByRuntimeOwner = { ...vpsByHostId, hostId: undefined, runtimeOwnerEnvironmentId: ENV }

/** The key the footer's vps row passes, then the row the dialog's own list resolves it to. */
function footerThenDialog(): { footer: string | undefined; dialog: string | undefined } {
  const footerRows = renderHook(() => useHandoffDestinations(macMain.id, 'local')).result.current
  const footer = footerRows?.find((row) => row.hostId === VPS && !row.block)?.key
  const dialogRows = renderHook(() => useHandoffDestinations(macMain.id)).result.current
  return { footer, dialog: resolveHandoffDestination(dialogRows, footer)?.key }
}

describe('footer host pick vs dialog preselection, vps has the same branch', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  for (const [name, vps] of [
    ['vps row stamped with hostId', vpsByHostId],
    ['vps row stamped with runtime owner', vpsByRuntimeOwner]
  ] as const) {
    it(`${name}: not focused`, () => {
      seed(vps)
      const { footer, dialog } = footerThenDialog()
      expect(footer).toBe(`host:${VPS}`)
      expect(dialog).toBe(footer)
    })
    it(`${name}: chat workspace focused`, () => {
      seed(vps, { activeWorktreeId: macMain.id, activeWorkspaceExecutionHostId: 'local' })
      const { footer, dialog } = footerThenDialog()
      expect(footer).toBe(`host:${VPS}`)
      expect(dialog).toBe(footer)
    })
  }
})
