import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AgentSessionContinuationRequest } from '../../../../shared/agent-session/conversation-context/agent-session-continuation'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import type { ProjectHostSetup } from '../../../../shared/project/project-types'
import type { PublicKnownRuntimeEnvironment } from '../../../../shared/remote-runtime/host-catalog/runtime-environments'
import { getRuntimeAgentInventoryKey } from '@/store/slices/agent-inventory/runtime-agent-inventory-key'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { AgentSessionContinuationDialog } from './AgentSessionContinuationDialog'

const repo: Repo = {
  id: 'orca',
  path: '/Users/me/orca',
  displayName: 'orca',
  badgeColor: '',
  addedAt: 1
}

const worktree: Worktree = {
  id: 'orca::/Users/me/orca/workspaces/fix-login',
  repoId: repo.id,
  path: '/Users/me/orca/workspaces/fix-login',
  displayName: 'fix-login',
  branch: 'fix-login',
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
  lastActivityAt: 1
}

const request: AgentSessionContinuationRequest = {
  source: {
    sourceAgent: 'claude',
    capturedText: 'Fixed the login redirect; tests pass except the SSO case.',
    sourceTitle: 'Fix login redirect',
    lastPrompt: 'Make the login redirect keep the return URL.',
    lastAssistantMessage: 'Fixed the login redirect; tests pass except the SSO case.'
  },
  worktreeId: worktree.id,
  workspacePath: worktree.path,
  launchSource: 'sidebar'
}

export const handoff = defineFixture({
  width: 640,
  store: { repos: [repo], worktreesByRepo: { [repo.id]: [worktree] } },
  render: () => (
    <div className="h-[460px] bg-background">
      <AgentSessionContinuationDialog open request={request} onOpenChange={() => {}} />
    </div>
  )
})

// Two hosts with the same project and a `develop` workspace on each; the Mac copy has unpushed work.
const VPS = 'runtime:vps' as const
const macRepo: Repo = {
  ...repo,
  id: 'app-mac',
  path: '/Users/me/app',
  displayName: 'app'
}
const vpsRepo: Repo = {
  ...repo,
  id: 'app-vps',
  path: '/srv/app',
  displayName: 'app',
  connectionId: null,
  executionHostId: VPS
}
const macDevelop: Worktree = {
  ...worktree,
  id: 'app-mac::/Users/me/app/workspaces/develop',
  repoId: macRepo.id,
  projectId: 'p',
  path: '/Users/me/app/workspaces/develop',
  displayName: 'develop',
  branch: 'refs/heads/develop'
}
const vpsDevelop: Worktree = {
  ...macDevelop,
  id: 'app-vps::/srv/app/workspaces/develop',
  repoId: vpsRepo.id,
  hostId: VPS,
  path: '/srv/app/workspaces/develop'
}

function hostSetup(
  id: string,
  hostId: Worktree['hostId'] & string,
  target: Repo
): ProjectHostSetup {
  return {
    id,
    projectId: 'p',
    hostId,
    repoId: target.id,
    path: target.path,
    displayName: 'app',
    executionHostId: hostId,
    setupState: 'ready',
    setupMethod: 'cloned',
    createdAt: 1,
    updatedAt: 1
  }
}

const vpsEnvironment: PublicKnownRuntimeEnvironment = {
  id: 'vps',
  name: 'vps',
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: null,
  runtimeId: null,
  endpoints: [],
  preferredEndpointId: 'vps'
}

let defaultStatus: typeof window.api.git.status | undefined
let defaultUpstream: typeof window.api.git.upstreamStatus | undefined

async function pickRadio(index: number): Promise<void> {
  for (let tries = 0; tries < 60; tries++) {
    const radio = document.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]
    if (radio && !radio.disabled) {
      radio.click()
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

// The vps lists its agents, as a paired host answers detection; the harness has no real vps.
const vpsAgents: TuiAgent[] = ['codex', 'claude', 'gemini']
const vpsInventoryKey = getRuntimeAgentInventoryKey('vps', vpsDevelop.id)

/** `pushed`: after Commit & push, the Mac copy is clean and Start opens on the vps.
 * `preselected`: opened from the composer's host menu, so the vps row starts picked. */
function toServer(pushed: boolean, preselected = false) {
  return defineFixture({
    width: 640,
    store: {
      repos: [macRepo, vpsRepo],
      projectHostSetups: [hostSetup('s-mac', 'local', macRepo), hostSetup('s-vps', VPS, vpsRepo)],
      worktreesByRepo: {
        [macRepo.id]: [macDevelop],
        [vpsRepo.id]: [vpsDevelop]
      },
      runtimeEnvironments: [vpsEnvironment],
      runtimeStatusByEnvironmentId: new Map([
        [
          'vps',
          {
            status: createCompatibleRuntimeStatusResponse('vps').result,
            checkedAt: 1
          }
        ]
      ]),
      runtimeDetectedAgentIds: { [vpsInventoryKey]: vpsAgents },
      runtimeAgentInventoryOutcome: () => 'successful',
      ensureRuntimeDetectedAgents: async () => vpsAgents
    },
    setup: () => {
      defaultStatus ??= window.api.git.status
      defaultUpstream ??= window.api.git.upstreamStatus
      const changed = pushed ? [] : ['src/login.ts', 'src/redirect.ts', 'test/login.test.ts']
      window.api.git.status = async () => ({
        entries: changed.map((path) => ({
          path,
          status: 'modified' as const,
          area: 'unstaged' as const
        })),
        conflictOperation: 'unknown' as const,
        branch: 'refs/heads/develop'
      })
      window.api.git.upstreamStatus = async () => ({
        hasUpstream: true,
        upstreamName: 'origin/develop',
        ahead: pushed ? 0 : 2,
        behind: 0
      })
    },
    interact: preselected ? undefined : () => pickRadio(1),
    render: () => (
      <div className="h-[760px] bg-background">
        <AgentSessionContinuationDialog
          open
          request={{
            ...request,
            worktreeId: macDevelop.id,
            workspacePath: macDevelop.path
          }}
          initialEnvironmentKey={preselected ? `host:${VPS}` : undefined}
          onOpenChange={() => {}}
        />
      </div>
    )
  })
}

export const handoffToServer = toServer(false)
export const handoffToServerPushed = toServer(true)
export const handoffToServerPreselected = toServer(false, true)
