import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import { translate } from '@/i18n/i18n'
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
  /** The other host holding the project, offered beside Resume. */
  continueHost?: string
  session?: AiVaultSession
  originHost?: string
}) {
  const originHost = props.originHost ?? 'mac'
  return (
    <VaultSessionRow
      session={props.session ?? copy}
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
      resumeLabel={aiVaultSessionResumeLabel({
        usesSessionWorktree: true,
        originHostLabel: originHost
      })}
      resumeActions={{
        worktree: { worktreeId: props.worktreeId, disabled: !props.worktreeId },
        newTab: { worktreeId: null, disabled: true }
      }}
      onResumeInWorktree={noop}
      onResumeInNewTab={noop}
      onCopyId={noop}
      sourceHostLabel={aiVaultOtherMachineLabel(originHost)}
      onPick={props.picker ? noop : undefined}
      onContinueInNewSession={props.continueHost ? noop : undefined}
      continueLabel={
        props.continueHost
          ? translate(
              'components.agentSessionContinuation.continueOnHost',
              'Continue on {{host}}',
              {
                host: props.continueHost
              }
            )
          : undefined
      }
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

// The project is set up on the Mac and the VPS: Resume on the Mac, or continue on the VPS.
export const sidebarContinueOnHost = defineFixture({
  width: 560,
  render: () =>
    row({ picker: false, worktreeId: 'repo-mac::/Users/me/DEV/kit', continueHost: 'vps' })
})

// The history modal's expanded card: a copy recorded on the VPS offers Resume there or Continue here.
export const modalHostActions = defineFixture({
  width: 480,
  render: () =>
    row({
      picker: true,
      worktreeId: 'repo-vps::/home/me/projects/Personal-ProOps-app',
      continueHost: 'Local Mac',
      originHost: 'vps',
      session: {
        ...copy,
        title: 'Recorded on vps',
        cwd: '/home/me/projects/Personal-ProOps-app',
        cwdAliases: [],
        model: 'claude-opus-5-5',
        branch: 'main'
      }
    })
})
