import { useEffect, useRef, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import {
  AGENT_CHAT_ACCOUNT_OPTION_ID,
  agentSupportsChatAccountChoice
} from '../../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { AGENT_SESSION_CHAT_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../../../../shared/agent-session/lifecycle/operations/agent-session-create-capabilities'
import {
  AGENT_SESSION_AGENT_SWITCH_RUNTIME_CAPABILITY,
  type AgentSessionAgentSwitchTarget
} from '../../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import { switchStructuredAgentSessionAgent } from '@/runtime/native-chat/requests/structured-agent-session-switch-agent'
import {
  chatProviderAgents,
  useHostStructuredAgentsVersion
} from '@/runtime/native-chat/agent-catalogs/chat-provider-agents'
import { executionHostIdForStructuredTarget } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { readRuntimeStatuses } from '@/store/slices/runtime-status/views/runtime-status-owner'
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
  /** Present once the chat has started on a host that continues it on another agent or account. */
  agentSwitch?: NativeChatAgentSwitch
}

/** "Continue with": the started chat's move to another agent or account, in place. */
export type NativeChatAgentSwitch = {
  /** The agent the chat runs on now. */
  agent: string
  /** The agents this host runs chats for, the current one included. */
  agents: readonly string[]
  /** A turn is running or waiting on the person: the host refuses unless it stops the turn. */
  busy: boolean
  switchTo: (target: AgentSessionAgentSwitchTarget, stopRunning?: boolean) => Promise<void>
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
  /** A turn is running or waiting on an answer. */
  turnRunning?: boolean
  /** The chat's Stop, which "Stop and switch" presses before it switches. */
  stopTurn?: () => Promise<unknown>
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
  const switchCapability = useStructuredAgentSessionHostCapabilityState(
    target,
    AGENT_SESSION_AGENT_SWITCH_RUNTIME_CAPABILITY
  )
  useHostStructuredAgentsVersion()
  // "Stop and switch" waits here for the stopped turn to end; the host switches only a chat at rest.
  const afterStop = useRef<{ next: AgentSessionAgentSwitchTarget; done: () => void } | null>(null)
  const switchNow = useRef<(next: AgentSessionAgentSwitchTarget) => Promise<void>>(async () => {})
  const running = useRef(args.turnRunning === true)
  const runPending = (): void => {
    const pending = afterStop.current
    if (!pending || running.current) {
      return
    }
    afterStop.current = null
    void switchNow.current(pending.next).finally(pending.done)
  }
  useEffect(() => {
    running.current = args.turnRunning === true
    runPending()
  }, [args.turnRunning])
  const ownsAccount = agentSupportsChatAccountChoice(agent) && capability === 'supported'
  // A created chat that never ran still picks its account through the option, as before.
  const switchFence =
    switchCapability === 'supported' && args.sessionNeverStarted !== true ? fence : null
  if (!ownsAccount && switchFence === null) {
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
  switchNow.current = async (next) => {
    if (switchFence === null) {
      return
    }
    const outcome = await switchStructuredAgentSessionAgent(target, sessionId, switchFence, next)
    if (outcome.kind === 'failed') {
      toast.error(outcome.text)
    }
    reread()
  }
  const switchTo = async (
    next: AgentSessionAgentSwitchTarget,
    stopRunning?: boolean
  ): Promise<void> => {
    if (!stopRunning || !args.turnRunning || !args.stopTurn) {
      return switchNow.current(next)
    }
    afterStop.current?.done()
    // Waiting before the Stop is sent, so a turn that ends first still switches.
    const switched = new Promise<void>((done) => {
      afterStop.current = { next, done }
    })
    const pending = afterStop.current
    const stopped = await args.stopTurn().catch(() => null)
    if (stopped === null && afterStop.current === pending) {
      // Nothing was stopped: drop the wait rather than switch at some later turn's end.
      afterStop.current = null
      pending?.done()
    }
    runPending()
    await switched
  }
  return {
    target,
    choice: beforeCreate ? (held ?? projectChoice) : args.hostChoice,
    ...(ownsAccount && (beforeCreate || args.sessionNeverStarted === true)
      ? { choose: (choice: string) => void choose(choice) }
      : {}),
    ...(switchFence !== null
      ? {
          agentSwitch: {
            agent,
            agents: chatProviderAgents(
              executionHostIdForStructuredTarget(target),
              readRuntimeStatuses()
            ),
            busy: args.turnRunning === true,
            switchTo
          }
        }
      : {})
  }
}
