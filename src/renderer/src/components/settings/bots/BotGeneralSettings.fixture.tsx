import { defineFixture } from '../../../component-fixtures/component-fixture'
import { setLocalRuntimeCapabilitiesForTests } from '@/runtime/hosts/capabilities/local-runtime-capabilities'
import { RUNTIME_CAPABILITIES } from '../../../../../shared/remote-runtime/protocol/protocol-version'
import type { ClaudeRateLimitAccountsState } from '../../../../../shared/agent-accounts/managed-account-types'
import type { Bot } from '../../../../../shared/bot-types'
import { ConfirmationDialogProvider } from '../../dismiss/confirmation/confirmation-dialog'
import { BotAgentSettings } from './BotGeneralSettings'

const account = (id: string, displayName: string, email: string) => ({
  id,
  displayName,
  email,
  authMethod: 'subscription-oauth' as const,
  createdAt: 1,
  updatedAt: 1,
  lastAuthenticatedAt: 1
})
const accounts: ClaudeRateLimitAccountsState = {
  accounts: [
    account('acct-work', 'Work', 'work@example.com'),
    account('acct-personal', 'Personal', 'me@example.com')
  ],
  activeAccountId: 'acct-personal'
}

const bot: Bot = {
  id: 'bot-release',
  name: 'Release',
  hostId: 'local',
  folder: 'release',
  folderWorkspaceId: 'fw-release',
  agent: 'claude',
  launch: { model: 'opus' },
  agentAccount: 'acct-work',
  avatar: null,
  paused: false,
  notifications: { needsPermission: true, taskComplete: true, couldNotFinish: true },
  members: [],
  slack: null,
  linear: null,
  github: null,
  chatSessionId: null,
  createdAt: 1,
  updatedAt: 1
}

function stubAccounts(): void {
  setLocalRuntimeCapabilitiesForTests(RUNTIME_CAPABILITIES)
  window.api.claudeAccounts.list = async () => accounts
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 300))

export const accountPicked = defineFixture({
  width: 640,
  setup: stubAccounts,
  render: () => (
    <ConfirmationDialogProvider>
      <BotAgentSettings bot={bot} update={async () => bot} />
    </ConfirmationDialogProvider>
  ),
  interact: settle
})

export const accountPickedNarrow = defineFixture({ ...accountPicked, width: 380 })

export const accountMenuOpen = defineFixture({
  ...accountPicked,
  interact: async (frame) => {
    await settle()
    const trigger = frame.querySelector<HTMLButtonElement>('button[aria-label="Account"]')
    trigger?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
    )
    await settle()
  }
})
