import { MessageSquarePlus } from 'lucide-react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { NativeChatComposerWorkspace } from './NativeChatComposerWorkspace'
import { useAppStore } from '@/store'
import { NativeChatHandOffContext } from '../../pane/actions/use-native-chat-hand-off'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import type { ProjectHostSetup } from '../../../../../../shared/project/project-types'
import type { PublicKnownRuntimeEnvironment } from '../../../../../../shared/remote-runtime/host-catalog/runtime-environments'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { NativeChatContinueOnHostItems } from '../../pane/actions/NativeChatContinueOnHostItems'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

// The chat's context menu around the same rows the real menu renders.
function ChatMenuPreview({
  worktreeId,
  hostId
}: {
  worktreeId: string
  hostId: ExecutionHostId
}): React.JSX.Element {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger data-menu-fixture-trigger className="px-3 text-xs">
        Chat menu
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem>Find</DropdownMenuItem>
        <DropdownMenuItem>
          <MessageSquarePlus />
          Hand off to agent
        </DropdownMenuItem>
        <NativeChatContinueOnHostItems worktreeId={worktreeId} hostId={hostId} handOff={HAND_OFF} />
        <DropdownMenuItem>Copy session ID</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const HAND_OFF = { openTo: () => {}, disabled: false }

// The same project on this computer and a paired server, each with a `feat/mobile-app` workspace.
function hostSwitchFixture({
  chatOnVps = false,
  menuOnly = false,
  name = 'app',
  branch = 'refs/heads/feat/mobile-app'
}: { chatOnVps?: boolean; menuOnly?: boolean; name?: string; branch?: string } = {}) {
  const vps = 'runtime:vps' as const
  const macRepo: Repo = {
    id: 'app-mac',
    path: '/Users/me/app',
    displayName: 'app',
    badgeColor: '',
    addedAt: 1,
    kind: 'git',
    executionHostId: 'local'
  }
  const vpsRepo: Repo = { ...macRepo, id: 'app-vps', path: '/srv/app', executionHostId: vps }
  const macCheckout: Worktree = {
    id: `${macRepo.id}::${macRepo.path}`,
    repoId: macRepo.id,
    projectId: 'p',
    hostId: 'local',
    path: macRepo.path,
    displayName: name,
    branch,
    head: 'a1b2c3d4e5f6',
    isBare: false,
    isMainWorktree: true,
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
  const vpsCheckout: Worktree = {
    ...macCheckout,
    id: `${vpsRepo.id}::${vpsRepo.path}`,
    repoId: vpsRepo.id,
    hostId: vps,
    path: vpsRepo.path
  }
  const chatCheckout = chatOnVps ? vpsCheckout : macCheckout
  const setup = (hostId: 'local' | typeof vps, target: Repo): ProjectHostSetup => ({
    id: `setup-${target.id}`,
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
  })
  const environment: PublicKnownRuntimeEnvironment = {
    id: 'vps',
    name: 'vps',
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
    runtimeId: null,
    endpoints: [],
    preferredEndpointId: 'vps'
  }
  return defineFixture({
    width: 640,
    store: {
      repos: [macRepo, vpsRepo],
      projectHostSetups: [setup('local', macRepo), setup(vps, vpsRepo)],
      worktreesByRepo: { [macRepo.id]: [macCheckout], [vpsRepo.id]: [vpsCheckout] },
      runtimeEnvironments: [environment],
      runtimeStatusByEnvironmentId: new Map([
        ['vps', { status: createCompatibleRuntimeStatusResponse('vps').result, checkedAt: 1 }]
      ]),
      unifiedTabsByWorktree: {
        [chatCheckout.id]: [
          {
            id: 'composer-preview-tab',
            entityId: 'composer-preview-session',
            contentType: 'agent-session',
            agentSessionAgent: 'codex',
            worktreeId: chatCheckout.id,
            groupId: 'preview',
            executionHostId: chatOnVps ? vps : 'local',
            label: 'Chat',
            customLabel: null,
            color: null,
            sortOrder: 0,
            createdAt: 1
          }
        ]
      }
    },
    setup: () => {
      useAppStore.setState((state) => ({
        settings: {
          ...getDefaultSettings('/home/fixture'),
          ...state.settings,
          hostSettingOverrides: { local: { displayLabel: 'Local Mac' } }
        },
        // The chat's workspace is the one the app has open.
        activeWorktreeId: chatCheckout.id
      }))
    },
    render: () => (
      <NativeChatHandOffContext.Provider value={HAND_OFF}>
        <div className="native-chat-appearance bg-background pt-40 pb-3">
          {menuOnly ? (
            <ChatMenuPreview worktreeId={chatCheckout.id} hostId={chatOnVps ? vps : 'local'} />
          ) : (
            <NativeChatComposerWorkspace terminalTabId="composer-preview-tab" />
          )}
        </div>
      </NativeChatHandOffContext.Provider>
    ),
    interact: async (frame) => {
      const trigger = frame.querySelector<HTMLButtonElement>(
        menuOnly ? '[data-menu-fixture-trigger]' : '[aria-label="Continue on another host"]'
      )
      if (!trigger) {
        throw new Error('The footer host must be a selector when the chat can hand off')
      }
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  })
}

export const hostSwitch = hostSwitchFixture()

// A Claude chat on the VPS: the footer offers to continue it on this Mac.
export const continueOnLocalMac = hostSwitchFixture({
  chatOnVps: true,
  name: 'Proops erp task',
  branch: 'refs/heads/ci/runner-vps'
})

export const continueOnLocalMacMenu = hostSwitchFixture({
  chatOnVps: true,
  menuOnly: true,
  name: 'Proops erp task',
  branch: 'refs/heads/ci/runner-vps'
})
