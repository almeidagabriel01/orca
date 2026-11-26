import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type { ProjectHostSetup } from '../../../../../../shared/project/project-types'
import type { PublicKnownRuntimeEnvironment } from '../../../../../../shared/remote-runtime/host-catalog/runtime-environments'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { createCompatibleRuntimeStatusResponse } from '@/runtime/rpc/testing/runtime-compatibility-test-fixture'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { useTranslate } from '@/i18n/use-translate'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { useAiVaultPanelHostScope } from '../scope/ai-vault-host-scope'
import { aiVaultHostLabel } from '../search/ai-vault-search-hit-hosts'
import { useAiVaultPanelSessionResume } from '../session-actions/use-ai-vault-panel-session-resume'
import { aiVaultOtherMachineLabel } from '../session-actions/ai-vault-session-other-machine'
import { AiVaultVirtualRow } from './AiVaultVirtualRow'

const VPS = 'runtime:vps' as const
const MAC_PATH = '/Users/me/DEV/erp'
const VPS_PATH = '/home/me/projects/erp'

const macRepo: Repo = {
  id: 'erp-mac',
  path: MAC_PATH,
  displayName: 'erp',
  badgeColor: '',
  addedAt: 1,
  kind: 'git',
  executionHostId: 'local'
}
const vpsRepo: Repo = { ...macRepo, id: 'erp-vps', path: VPS_PATH, executionHostId: VPS }
const macCheckout: Worktree = {
  id: `${macRepo.id}::${MAC_PATH}`,
  repoId: macRepo.id,
  projectId: 'erp',
  hostId: 'local',
  path: MAC_PATH,
  displayName: 'erp',
  branch: 'refs/heads/ci/runner-vps',
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
  id: `${vpsRepo.id}::${VPS_PATH}`,
  repoId: vpsRepo.id,
  hostId: VPS,
  path: VPS_PATH
}

// The screenshot's conversation: Claude on the VPS, 342 messages.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; only the fields the row reads
const vpsSession = {
  id: 'runtime:vps:claude:item-36',
  agent: 'claude',
  sessionId: 'item-36',
  title: 'ERP, item 36: runner self-hosted na VPS pela fila pesada. Você continua daqui?',
  executionHostId: VPS,
  cwd: VPS_PATH,
  branch: 'ci/runner-vps',
  model: 'claude-opus-5-5',
  filePath: '/home/me/.claude/projects/-home-me-projects-erp/item-36.jsonl',
  codexHome: null,
  createdAt: '2026-11-25T18:00:00.000Z',
  updatedAt: '2026-11-25T19:10:00.000Z',
  modifiedAt: '2026-11-25T19:10:00.000Z',
  messageCount: 342,
  totalTokens: 0,
  previewMessages: [
    {
      role: 'user',
      text: 'Orca restarted. Resume the original unfinished user task with existing commitments and authorization.',
      timestamp: null
    },
    {
      role: 'assistant',
      text: 'O shard do Lighthouse que está no runner 4 roda sozinho desde 21:16 UTC, com a máquina toda.',
      timestamp: null
    }
  ],
  queuedMessageCount: 0,
  subagentTranscriptCount: 3,
  resumeCommand: '',
  subagent: null
} as unknown as AiVaultSession

// The same conversation as this Mac's synced copy, listed while the VPS row is filtered out.
const vpsCopyOnMac: AiVaultSession = {
  ...vpsSession,
  id: 'local:claude:item-36',
  executionHostId: 'local',
  cwdAliases: [MAC_PATH],
  recordedOnOtherMachine: true,
  filePath: '/Users/me/.claude/projects/-home-me-projects-erp/item-36.jsonl'
}

const macSession: AiVaultSession = {
  ...vpsSession,
  id: 'local:claude:item-41',
  sessionId: 'item-41',
  title: 'ERP, item 41: fila de notas fiscais no Mac',
  executionHostId: 'local',
  cwd: MAC_PATH,
  messageCount: 58,
  subagentTranscriptCount: 0,
  filePath: '/Users/me/.claude/projects/-Users-me-DEV-erp/item-41.jsonl'
}

const noop = (): void => {}

/** One History row through the panel's own resolvers, as the modal or the sidebar renders it. */
function HistoryRow({
  session,
  picker
}: {
  session: AiVaultSession
  picker: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const allWorktrees = useAllWorktrees()
  const resumeTargetState = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      settings: state.settings,
      folderWorkspaces: selectFolderWorkspaces(state),
      projectGroups: state.projectGroups,
      repos: state.repos,
      worktreesByRepo: selectWorktreesByRepo(state)
    }))
  )
  const { hostScopeOptions } = useAiVaultPanelHostScope(activeWorktreeId, resumeTargetState)
  const resume = useAiVaultPanelSessionResume({
    sessions: [session],
    repos: resumeTargetState.repos,
    allWorktrees,
    workspaceId: activeWorktreeId,
    resumeTargetState,
    hostLabel: useCallback(
      (hostId: ExecutionHostId) => aiVaultHostLabel(hostId, hostScopeOptions, t),
      [hostScopeOptions, t]
    )
  })
  return (
    <div className="bg-sidebar">
      <AiVaultVirtualRow
        row={{ type: 'session', groupKey: 'erp', session }}
        index={0}
        start={0}
        // In-flow so the frame fits the row; the list positions rows absolutely.
        activeStickyHeader
        measureElement={noop}
        groupCollapsed={false}
        detailsExpanded
        vaultScope="workspace"
        buildResumeStartup={() => ({ command: '' })}
        getOriginalPaneTarget={() => null}
        isStructuredSessionOpen={() => false}
        getSessionLiveState={() => null}
        getWorktreeInfo={resume.getSessionWorktreeInfo}
        getSessionResumeState={resume.getSessionResumeState}
        getSessionResumeActions={resume.getSessionResumeActions}
        getSessionResumeInChat={resume.getSessionResumeInChat}
        onToggleGroup={noop}
        onToggleSessionDetails={noop}
        onJumpToOriginalPane={noop}
        onJumpToWorktree={noop}
        onResume={noop}
        onContinueInNewSession={noop}
        onResumeInNewChat={noop}
        onResumeInNewCli={noop}
        onCopyResume={noop}
        onCopyId={noop}
        onCopyPath={noop}
        onOpenLog={noop}
        onRevealLog={noop}
        onOpenCwd={noop}
        onRevealArtifacts={noop}
        onRequestDelete={noop}
        sourceHostLabel={
          session.recordedOnOtherMachine
            ? aiVaultOtherMachineLabel(resume.getSessionResumeState(session).originHostLabel)
            : undefined
        }
        onPickSession={picker ? noop : undefined}
      />
    </div>
  )
}

const setup = (hostId: 'local' | typeof VPS, target: Repo): ProjectHostSetup => ({
  id: `setup-${target.id}`,
  projectId: 'erp',
  hostId,
  repoId: target.id,
  path: target.path,
  displayName: 'erp',
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

/** The project set up on this Mac and on the paired VPS, the app focused on the Mac's workspace. */
function historyFixture({
  session,
  picker,
  width = 560,
  vpsOffline = false,
  macSetUp = true,
  hoverReason = false
}: {
  session: AiVaultSession
  picker: boolean
  width?: number
  vpsOffline?: boolean
  macSetUp?: boolean
  /** Focus the first disabled button's wrapper so its reason tooltip is captured. */
  hoverReason?: boolean
}) {
  return defineFixture({
    width,
    store: {
      repos: macSetUp ? [macRepo, vpsRepo] : [vpsRepo],
      projectHostSetups: macSetUp
        ? [setup('local', macRepo), setup(VPS, vpsRepo)]
        : [setup(VPS, vpsRepo)],
      worktreesByRepo: macSetUp
        ? { [macRepo.id]: [macCheckout], [vpsRepo.id]: [vpsCheckout] }
        : { [vpsRepo.id]: [vpsCheckout] },
      runtimeEnvironments: [environment],
      runtimeStatusByEnvironmentId: new Map([
        [
          'vps',
          vpsOffline
            ? { status: null, checkedAt: 1 }
            : { status: createCompatibleRuntimeStatusResponse('vps').result, checkedAt: 1 }
        ]
      ])
    },
    setup: () => {
      useAppStore.setState((state) => ({
        settings: {
          ...getDefaultSettings('/home/fixture'),
          ...state.settings,
          hostSettingOverrides: { local: { displayLabel: 'Local Mac' } }
        },
        activeWorktreeId: macSetUp ? macCheckout.id : vpsCheckout.id
      }))
    },
    render: () => <HistoryRow session={session} picker={picker} />,
    interact: hoverReason
      ? async (frame) => {
          const wrapper = frame.querySelector<HTMLElement>('[data-host-action-reason]')
          if (!wrapper) {
            throw new Error('Expected a disabled host action with a reason')
          }
          wrapper.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
          wrapper.focus()
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      : undefined
  })
}

// The VPS conversation as this Mac's synced copy, in the history modal.
export const modalVpsCopyFromMac = historyFixture({ session: vpsCopyOnMac, picker: true })

// The screenshot's case: the modal filtered to the VPS, its own row.
export const modalVpsFiltered = historyFixture({ session: vpsSession, picker: true })

// A conversation recorded on this Mac, in the sidebar list.
export const sidebarMacRecorded = historyFixture({ session: macSession, picker: false })

export const modalVpsFilteredNarrow = historyFixture({
  session: vpsSession,
  picker: true,
  width: 300
})

// The VPS is disconnected: Resume there is greyed out with its reason.
export const modalVpsOffline = historyFixture({
  session: vpsSession,
  picker: true,
  vpsOffline: true,
  hoverReason: true
})

// The project is not set up on this Mac: Continue there is greyed out with its reason.
export const modalMacNotSetUp = historyFixture({
  session: vpsSession,
  picker: true,
  macSetUp: false,
  hoverReason: true
})

// The same outage seen through this Mac's synced copy: the copy and the VPS row agree.
export const modalVpsCopyOffline = historyFixture({
  session: vpsCopyOnMac,
  picker: true,
  vpsOffline: true
})
