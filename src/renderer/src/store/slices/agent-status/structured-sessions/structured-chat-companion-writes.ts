import type { StateCreator } from 'zustand'
import type { AppState } from '../../../types'
import type { AgentType } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { defaultAgentChatLabel } from '../../../../../../shared/agent-session/conversation-naming/agent-session-chat-label'
import { findTabAndWorktree, patchTab } from '../../tabs/tab-group-state'
import { withStructuredChatSleptAt } from './structured-chat-slept-at'
import {
  withoutStructuredSessionLaunchDirectory,
  withStructuredSessionLaunchDirectory
} from './structured-session-launch-directories'

/** A status projection's sleep, launch-directory and agent side facts, applied in order. */
export type StructuredChatCompanionWrite =
  | { kind: 'slept-at'; paneKey: string; sleptAt: number | null | undefined }
  | { kind: 'launch-directory'; tabId: string; sessionId: string; launchDirectory: string }
  | { kind: 'clear-launch-directory'; tabId: string; sessionId: string }
  /** The host moved the chat to another agent: its tab follows for icon, label and options. */
  | { kind: 'agent'; tabId: string; sessionId: string; agent: AgentType }

export type StructuredChatCompanionWritesSlice = {
  /** One store write per projection, so a reconnect snapshot does not notify once per chat. */
  applyStructuredChatCompanionWrites: (writes: readonly StructuredChatCompanionWrite[]) => void
}

export const createStructuredChatCompanionWritesSlice: StateCreator<
  AppState,
  [],
  [],
  StructuredChatCompanionWritesSlice
> = (set) => ({
  applyStructuredChatCompanionWrites: (writes) => {
    if (!writes.length) {
      return
    }
    set((state) => {
      let sleptAt = state.structuredChatSleptAtByPaneKey
      let directories = state.structuredSessionLaunchDirectoryByTabId
      let tabs = state.unifiedTabsByWorktree
      for (const write of writes) {
        if (write.kind === 'agent') {
          const tab = findTabAndWorktree(tabs, write.tabId)?.tab
          if (tab?.entityId === write.sessionId) {
            // A label still the old agent's default names the new one; a chosen name stays.
            const relabel = tab.label === defaultAgentChatLabel(tab.agentSessionAgent)
            tabs =
              patchTab(tabs, write.tabId, {
                agentSessionAgent: write.agent,
                ...(relabel ? { label: defaultAgentChatLabel(write.agent) } : {})
              })?.unifiedTabsByWorktree ?? tabs
          }
        } else if (write.kind === 'slept-at') {
          sleptAt = withStructuredChatSleptAt(sleptAt, write.paneKey, write.sleptAt)
        } else if (write.kind === 'launch-directory') {
          directories = withStructuredSessionLaunchDirectory(
            directories,
            write.tabId,
            write.sessionId,
            write.launchDirectory
          )
        } else {
          directories = withoutStructuredSessionLaunchDirectory(
            directories,
            write.tabId,
            write.sessionId
          )
        }
      }
      if (
        sleptAt === state.structuredChatSleptAtByPaneKey &&
        directories === state.structuredSessionLaunchDirectoryByTabId &&
        tabs === state.unifiedTabsByWorktree
      ) {
        return state
      }
      return {
        ...(tabs !== state.unifiedTabsByWorktree ? { unifiedTabsByWorktree: tabs } : {}),
        ...(sleptAt !== state.structuredChatSleptAtByPaneKey
          ? { structuredChatSleptAtByPaneKey: sleptAt }
          : {}),
        ...(directories !== state.structuredSessionLaunchDirectoryByTabId
          ? { structuredSessionLaunchDirectoryByTabId: directories }
          : {})
      }
    })
  }
})
