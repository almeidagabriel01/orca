import { defineFixture } from '../../component-fixtures/component-fixture'
import { buildHandoffDestinations } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import type { ProjectHostSetupOption } from '@/lib/workspace/creation/project-host-setup-options'
import type { Worktree } from '../../../../shared/worktree/types'
import { HandoffEnvironmentField } from './HandoffEnvironmentField'

function worktree(id: string, branch: string, hostId: Worktree['hostId'], at: number): Worktree {
  return {
    id,
    repoId: hostId === 'local' ? 'app-mac' : 'app-vps',
    hostId,
    path: `/work/${branch}`,
    displayName: branch,
    branch: `refs/heads/${branch}`,
    head: 'abc123',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: at
  }
}

const source = worktree('vps::develop', 'develop', 'runtime:vps', 5)

const hostOptions: ProjectHostSetupOption[] = [
  {
    id: 's-vps',
    kind: 'ready',
    projectId: 'p',
    hostId: 'runtime:vps',
    repoId: 'app-vps',
    label: 'vps',
    detail: 'app',
    path: '/srv/app'
  },
  {
    id: 's-mac',
    kind: 'ready',
    projectId: 'p',
    hostId: 'local',
    repoId: 'app-mac',
    label: 'Local Mac',
    detail: 'app',
    path: '/Users/me/app'
  },
  {
    id: 'needs-setup:runtime:box',
    kind: 'needs-setup',
    projectId: 'p',
    hostId: 'runtime:box',
    label: 'build-box',
    detail: 'Connect this host to set up projects',
    isAvailable: false,
    attention: false,
    canSetLocation: false
  }
]

function destinations(macWorktrees: Worktree[], macHealth: 'local' | 'disconnected' = 'local') {
  return buildHandoffDestinations({
    source,
    sourceHostId: 'runtime:vps',
    sourceIsFolder: false,
    hostOptions,
    hosts: [
      { id: 'runtime:vps', kind: 'runtime', health: 'available' },
      { id: 'local', kind: 'local', health: macHealth },
      { id: 'runtime:box', kind: 'runtime', health: 'disconnected' }
    ],
    worktreesByRepo: { 'app-vps': [source], 'app-mac': macWorktrees },
    hostUnavailableDetail: (host) =>
      host.health === 'disconnected' ? 'Connect this host to set up projects' : null
  })
}

const frame = (list: ReturnType<typeof destinations>, value: string) => () => (
  <div className="bg-background p-4">
    <HandoffEnvironmentField destinations={list} value={value} onChange={() => {}} />
  </div>
)

const macPickedList = destinations([worktree('mac::develop', 'develop', 'local', 3)])

export const macPicked = defineFixture({
  width: 520,
  render: frame(macPickedList, macPickedList[1]!.key)
})

// Mac offline, build-box has no project, and a Mac with no workspace on the branch are each spelled out.
const macOffline = destinations([worktree('mac::develop', 'develop', 'local', 3)], 'disconnected')
const macNoBranch = destinations([worktree('mac::feat', 'feat/mobile-app', 'local', 4)])

export const hostOffline = defineFixture({
  width: 520,
  render: frame(macOffline, macOffline[0]!.key)
})

export const branchMissing = defineFixture({
  width: 520,
  render: frame(macNoBranch, macNoBranch[0]!.key)
})
