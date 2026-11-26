import React from 'react'
import { useAppStore } from '@/store'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { Worktree } from '../../../../../../shared/worktree/types'
import WorktreeCard from '../surface/WorktreeCard'
import * as agentExpansion from './worktree-card-agents-expansion-state'
import {
  FIXTURE_REPO,
  makeWorktree,
  seedWorkspaces,
  type WorkspaceSeed
} from '../../worktree-card-slot-fixture-seeds'

// The ProOps project as the sidebar groups it: the Mac checkout and the vps checkout.
const now = Date.now()
const PROOPS = { ...FIXTURE_REPO, displayName: 'ProOps' }
const MAC = 'proops-mac'
const VPS = 'proops-vps'

type Case = { mac: WorkspaceSeed['agents']; vps: WorkspaceSeed['agents']; active: string }

function seeds({ mac, vps }: Case): WorkspaceSeed[] {
  return [
    { id: MAC, name: 'feat/mobile-app', agents: mac, lastActivityMinutesAgo: 5 },
    { id: VPS, name: 'develop', agents: vps, lastActivityMinutesAgo: 5 }
  ]
}

function seed(value: Case): void {
  seedWorkspaces(seeds(value), now)
  for (const id of [MAC, VPS]) {
    agentExpansion.seedWorktreeAgentExpansionStateForTests(id, {
      expandedLineageParents: new Set<string>(),
      expandedIdleChildGroups: new Set<string>(),
      compactRootListExpanded: true
    })
  }
  useAppStore.setState((state) => ({
    activeWorktreeId: value.active,
    worktreeCardProperties: ['status', 'host', 'inline-agents'],
    repos: state.repos.map((repo) =>
      repo.id === FIXTURE_REPO.id ? { ...repo, displayName: 'ProOps' } : repo
    )
  }))
}

function workspace(id: string, name: string): Worktree {
  return { ...makeWorktree({ id, name, agents: [] }, now), branch: `refs/heads/${name}` }
}

function ProOps({ active }: { active: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 bg-worktree-sidebar py-1.5 text-worktree-sidebar-foreground">
      <div className="px-3 py-1 text-sm font-semibold">ProOps</div>
      {[
        { id: MAC, name: 'feat/mobile-app', host: 'Local Mac' },
        { id: VPS, name: 'develop', host: 'vps' }
      ].map((row) => (
        <WorktreeCard
          key={row.id}
          worktree={workspace(row.id, row.name)}
          repo={PROOPS}
          isActive={row.id === active}
          hostContextLabel={row.host}
          contentIndent={20}
          flushSurface
          nativeDragEnabled={false}
        />
      ))}
    </div>
  )
}

const macChat = {
  agentType: 'claude',
  state: 'done' as const,
  minutesAgo: 5,
  prompt: 'Personalizar plugin do Cowork'
}
const vpsChat = {
  agentType: 'claude',
  state: 'done' as const,
  minutesAgo: 2,
  prompt: 'Runner self-hosted GitHub Actions ProOps'
}

function fixture(value: Case) {
  return defineFixture({
    width: 320,
    setup: () => seed(value),
    render: () => <ProOps active={value.active} />
  })
}

/** History opened a vps conversation from the Mac: it lands under develop · vps, which is active. */
export const historyOpensVpsSession = fixture({ mac: [macChat], vps: [vpsChat], active: VPS })
