import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import {
  AGENT_CHAT_ACCOUNT_OPTION_ID,
  agentSupportsChatAccountChoice
} from '../../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { AGENT_SESSION_CHAT_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../../../../shared/agent-session/lifecycle/operations/agent-session-create-capabilities'
import type { RuntimeClientTarget } from '../../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { setStructuredSessionSelectionOption } from '@/lib/agent-session/launch/structured-agent-session-launch-options'
import { holdStructuredLaunchAccount } from '@/lib/agent-session/launch/structured-agent-session-launch-account'
import {
  getStructuredLaunchStateBySessionId,
  subscribeStructuredAgentLaunchStatus
} from '@/lib/agent-session/launch/structured-agent-session-launch-state-store'
import { agentSessionWriteFailureText } from '../../../messages/notices/agent-session-write-notice-text'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { projectAgentAccountChoice } from '../../../../../../../shared/agent-launch/choices/project-agent-launch-defaults'
import { findLaunchProjectRepo } from '@/runtime/agent-launch-settings/use-host-agent-launch-preferences'
import { worktreeLaunchWorkspace } from '@/lib/agent-session/launch/routing/agent-launch-route-input'

/** The account a chat runs on, as the composer shows and changes it. */
export type NativeChatAccountControl = {
  /** The host whose accounts the chat chooses from. */
  target: RuntimeClientTarget
  /** The chat's own account; absent follows the host's selection. */
  choice: string | undefined
  /** Absent once the chat has started: a running chat keeps the account it launched on. */
  choose?: (choice: string) => void
}

/** Present for an agent and host that run a chat on an account of its own. */
export function useStructuredChatAccount(args: {
  agent: string
  sessionId: string
  target: RuntimeClientTarget
  fence: number | null
  /** The host's last statement of the chat's account and whether it ever started. */
  hostChoice: string | undefined
  sessionNeverStarted: boolean | undefined
  reread: () => void
}): NativeChatAccountControl | undefined {
  const t = useTranslate()
  const { agent, sessionId, target, fence, reread } = args
  // A pick before create lives on the launch intent, so a remounted composer still shows it.
  const held = useSyncExternalStore(
    subscribeStructuredAgentLaunchStatus,
    () => getStructuredLaunchStateBySessionId(sessionId)?.intent.accountChoice
  )
  // Until a pick, a new chat shows the project's account, which its host seeds at create.
  const projectChoice = useAppStore((state) => {
    const intent = getStructuredLaunchStateBySessionId(sessionId)?.intent
    return intent && !intent.params.resumeFrom && !intent.params.forkFrom
      ? projectAgentAccountChoice(
          findLaunchProjectRepo(
            state,
            worktreeLaunchWorkspace(intent.worktreeId),
            intent.executionHostId
          ),
          agent
        )
      : undefined
  })
  const capability = useStructuredAgentSessionHostCapabilityState(
    target,
    AGENT_SESSION_CHAT_ACCOUNT_RUNTIME_CAPABILITY
  )
  if (!agentSupportsChatAccountChoice(agent) || capability !== 'supported') {
    return undefined
  }
  const beforeCreate = fence === null
  const choose = async (choice: string): Promise<void> => {
    if (beforeCreate) {
      holdStructuredLaunchAccount(sessionId, choice)
      return
    }
    const outcome = await setStructuredSessionSelectionOption(
      target,
      sessionId,
      fence,
      AGENT_CHAT_ACCOUNT_OPTION_ID,
      choice
    )
    if (outcome.kind !== 'accepted') {
      const failure = 'failure' in outcome ? outcome.failure : undefined
      toast.error(
        failure
          ? agentSessionWriteFailureText(failure, 'option')
          : t('components.native-chat.account.changeFailed', "Couldn't change the account.")
      )
    }
    reread()
  }
  return {
    target,
    choice: beforeCreate ? (held ?? projectChoice) : args.hostChoice,
    ...(beforeCreate || args.sessionNeverStarted === true
      ? { choose: (choice: string) => void choose(choice) }
      : {})
  }
}
