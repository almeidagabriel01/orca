import { translate } from '@/i18n/i18n'
import { compactIpcErrorMessage } from '@/runtime/errors/ipc-error'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { getTranslatedExecutionHostLabel } from '@/runtime/hosts/display/execution-host-label'
import { aiVaultAgentLabel } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import { parseExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type {
  AiVaultListArgs,
  AiVaultListResult,
  AiVaultSession
} from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

type OwnerChatDeps = {
  list: (args: AiVaultListArgs) => Promise<AiVaultListResult>
  open: (
    owner: Pick<AiVaultSession, 'structuredSession' | 'agent'>,
    target: RuntimeClientTarget
  ) => Promise<unknown>
  hostLabel: (hostId: AiVaultSession['executionHostId']) => string
}

const defaultDeps: OwnerChatDeps = {
  list: (args) => window.api.aiVault.listSessions(args),
  open: (owner, target) => activateAiVaultStructuredSession(owner, undefined, target),
  hostLabel: (hostId) => getTranslatedExecutionHostLabel(hostId)
}

export type AiVaultOwnershipRefusalOutcome =
  | { kind: 'opened-chat'; hostId: string; chat: NonNullable<AiVaultSession['structuredSession']> }
  | { kind: 'refused'; message: string }

/**
 * A host refuses a terminal resume of a conversation one of its chats holds. Its own history names
 * that chat, so open it there; a copy synced to another computer never carries that owner.
 */
export async function resolveAiVaultOwnershipRefusal(
  session: Pick<AiVaultSession, 'agent' | 'sessionId' | 'cwd' | 'executionHostId'>,
  error: unknown,
  deps: OwnerChatDeps = defaultDeps
): Promise<AiVaultOwnershipRefusalOutcome | null> {
  const code = error instanceof Error ? compactIpcErrorMessage(error.message) : null
  if (code !== 'agent_session_conflict' && code !== 'agent_session_ownership_unknown') {
    return null
  }
  const host = parseExecutionHostId(session.executionHostId)
  const target: RuntimeClientTarget | null =
    host?.kind === 'local'
      ? { kind: 'local' }
      : host?.kind === 'runtime'
        ? { kind: 'environment', environmentId: host.environmentId }
        : null
  const chat = target ? await findOwnerChat(session, deps).catch(() => null) : null
  if (target && chat) {
    await deps.open({ structuredSession: chat, agent: session.agent }, target)
    return { kind: 'opened-chat', hostId: session.executionHostId, chat }
  }
  const values = {
    agent: aiVaultAgentLabel(session.agent),
    host: deps.hostLabel(session.executionHostId)
  }
  return {
    kind: 'refused',
    message:
      code === 'agent_session_conflict'
        ? translate(
            'aiVault.ownerRefusal.runningElsewhere',
            'This {{agent}} conversation is running in another chat or terminal on {{host}}. Stop it there, then resume.',
            values
          )
        : translate(
            'aiVault.ownerRefusal.heldByChat',
            'An Orca chat on {{host}} holds this {{agent}} conversation, so it cannot also open in a terminal. Open that chat on {{host}} to continue.',
            values
          )
  }
}

async function findOwnerChat(
  session: Pick<AiVaultSession, 'agent' | 'sessionId' | 'cwd' | 'executionHostId'>,
  deps: OwnerChatDeps
): Promise<AiVaultSession['structuredSession'] | null> {
  // The recorded cwd scopes the host's scan to the folder that holds this conversation.
  const result = await deps.list({
    executionHostScope: session.executionHostId,
    ...(session.cwd ? { scopePaths: [session.cwd], scopeOnly: true } : {}),
    unlimited: true
  })
  const row = result.sessions.find(
    (candidate) =>
      candidate.agent === session.agent &&
      candidate.sessionId === session.sessionId &&
      !candidate.recordedOnOtherMachine &&
      candidate.structuredSession
  )
  return row?.structuredSession ?? null
}
