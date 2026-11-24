import type { AppState } from '../../../types'
import type { AgentType } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import { defaultAgentChatLabel } from '../../../../../../shared/agent-session/conversation-naming/agent-session-chat-label'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../../shared/workspace-layout/layout-owner-switch'
import { sendLayoutApply } from '@/runtime/workspace-layout/commands/layout-apply-send'
import { findTabAndWorktree, patchTab } from '../../tabs/tab-group-state'

type StoreSet = (update: (state: AppState) => Partial<AppState> | AppState) => void

export type ChatTabAgentChange = { tabId: string; sessionId: string; agent: AgentType }

/** The host moved the chat to another agent: its tab follows for icon, label and options. */
export function followChatTabAgent(
  set: StoreSet,
  state: AppState,
  change: ChatTabAgentChange
): void {
  const { tabId, sessionId, agent } = change
  const found = findTabAndWorktree(state.unifiedTabsByWorktree, tabId)
  if (
    !found ||
    found.tab.entityId !== sessionId ||
    found.tab.agentSessionAgent === agent ||
    !isTuiAgent(agent)
  ) {
    return
  }
  const { tab, worktreeId } = found
  // A label still the old agent's default names the new one; a chosen name stays.
  const relabel = tab.label === defaultAgentChatLabel(tab.agentSessionAgent)
  const local = (): void =>
    set(
      (current) =>
        patchTab(current.unifiedTabsByWorktree, tabId, {
          agentSessionAgent: agent,
          ...(relabel ? { label: defaultAgentChatLabel(agent) } : {})
        }) ?? current
    )
  const groupId = state.groupsByWorktree[worktreeId]?.find((group) =>
    group.tabOrder.includes(tabId)
  )?.id
  // Switch point: main retypes its copy of the tab; the host's chat list relabels the drawn tab.
  const sent =
    ORCA_LAYOUT_OWNER_IS_MAIN &&
    groupId !== undefined &&
    sendLayoutApply(
      state,
      worktreeId,
      { type: 'openAgentSessionTab', tabId, sessionId, agent, groupId },
      { apply: () => {}, asToday: local }
    )
  if (!sent) {
    local()
  }
}
