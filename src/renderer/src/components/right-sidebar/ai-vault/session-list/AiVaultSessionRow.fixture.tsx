import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import {
  aiVaultOtherMachineLabel,
  aiVaultOtherMachineOfflineReason
} from '../session-actions/ai-vault-session-other-machine'
import { aiVaultSessionResumeLabel } from '../session-actions/ai-vault-session-resume'
import { VaultSessionRow } from './AiVaultSessionRow'

// A Claude conversation synced from the Mac, listed by the VPS that holds the copy.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
const copy = {
  id: 'runtime:vps:claude:s1',
  agent: 'claude',
  sessionId: 's1',
  title: 'Starlog modules in the Kit CLI',
  executionHostId: 'runtime:vps',
  cwd: '/Users/me/DEV/kit',
  cwdAliases: ['/home/me/projects/kit'],
  recordedOnOtherMachine: true,
  branch: 'feat/integration-modules',
  model: 'claude-opus-4-5',
  filePath: '/home/me/.claude/projects/-Users-me-DEV-kit/s1.jsonl',
  codexHome: null,
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T15:00:00.000Z',
  modifiedAt: '2026-11-19T15:00:00.000Z',
  messageCount: 74,
  totalTokens: 0,
  previewMessages: [
    { role: 'user', text: 'Push the branch and confirm the remote hash.', timestamp: null },
    { role: 'assistant', text: 'The branch was pushed; the remote hash matches.', timestamp: null }
  ],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: '',
  subagent: null
} as unknown as AiVaultSession

const noop = (): void => {}

function row(props: {
  resumeUnavailableReason?: string
  worktreeId: string | null
  picker: boolean
}) {
  return (
    <VaultSessionRow
      session={copy}
      liveState={null}
      resumeStartup={{ command: '' }}
      realHomeResumeStartup={{ command: '' }}
      worktreeInfo={null}
      vaultScope="all"
      detailsExpanded
      resumeDisabled={!props.worktreeId}
      resumeUnavailableReason={props.resumeUnavailableReason}
      onToggleDetails={noop}
      showJumpToWorktree={false}
      onResume={noop}
      resumeLabel={aiVaultSessionResumeLabel({ usesSessionWorktree: true, originHostLabel: 'mac' })}
      resumeActions={{
        worktree: { worktreeId: props.worktreeId, disabled: !props.worktreeId },
        newTab: { worktreeId: null, disabled: true }
      }}
      onResumeInWorktree={noop}
      onResumeInNewTab={noop}
      onCopyId={noop}
      sourceHostLabel={aiVaultOtherMachineLabel('mac')}
      onPick={props.picker ? noop : undefined}
    />
  )
}

export const pickerOffline = defineFixture({
  width: 560,
  render: () =>
    row({
      picker: true,
      worktreeId: null,
      resumeUnavailableReason: aiVaultOtherMachineOfflineReason('mac')
    })
})

export const pickerBlocked = defineFixture({
  width: 560,
  render: () => row({ picker: true, worktreeId: null })
})

export const sidebarReady = defineFixture({
  width: 560,
  render: () => row({ picker: false, worktreeId: 'repo-mac::/Users/me/DEV/kit' })
})

export const sidebarBlocked = defineFixture({
  width: 560,
  render: () => row({ picker: false, worktreeId: null })
})
