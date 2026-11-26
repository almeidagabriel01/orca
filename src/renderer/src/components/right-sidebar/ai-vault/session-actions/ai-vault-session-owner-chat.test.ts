import { expect, it } from 'vitest'
import type {
  AiVaultListResult,
  AiVaultSession
} from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import { resolveAiVaultOwnershipRefusal } from './ai-vault-session-owner-chat'

// A synced copy resumed on the host that recorded it; that host's chat holds the conversation.
it('opens the recording host chat that holds a refused conversation instead of refusing', async () => {
  const chat = { sessionId: 'chat-1', workspaceId: 'repo::/home/me/kit' }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test fixture; only the fields under test are read
  const hostRow = {
    agent: 'claude',
    sessionId: 's1',
    executionHostId: 'runtime:vps',
    structuredSession: chat
  } as unknown as AiVaultSession
  const opened: unknown[] = []
  const outcome = await resolveAiVaultOwnershipRefusal(
    { agent: 'claude', sessionId: 's1', cwd: '/home/me/kit', executionHostId: 'runtime:vps' },
    new Error(
      "Error invoking remote method 'aiVault:prepareSessionResume': Error: agent_session_ownership_unknown"
    ),
    {
      list: async (): Promise<AiVaultListResult> => ({
        sessions: [hostRow],
        issues: [],
        scannedAt: ''
      }),
      open: async (owner, target) => opened.push({ owner, target }),
      hostLabel: () => 'vps'
    }
  )
  expect(outcome).toEqual({ kind: 'opened-chat', hostId: 'runtime:vps', chat })
  expect(opened).toEqual([
    {
      owner: { structuredSession: chat, agent: 'claude' },
      target: { kind: 'environment', environmentId: 'vps' }
    }
  ])
})
