import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/index'
import type { AppState } from '@/store/types'
import { useNow } from '@/lib/window-activity/use-now'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import { getAgentPaneExecutionHost } from '@/store/slices/agent-status/pane-authority/agent-pane-execution-host'
import { runtimeRpcTargetForAuthorityKey } from '@/runtime/rpc/targets/runtime-client-target'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { resolveAgentRowState } from '../../../../../shared/agent-status/presentation/agent-row-decay-state'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import {
  collectChatSessions,
  collectTerminalSessions,
  type UsageAgentSession,
  type UsageTerminalInput
} from './usage-account-sessions'

/** Ages recent rows out and lets silent working rows decay, as the sidebar does. */
const SESSION_CLOCK_MS = 30_000

function targetKey(target: RuntimeClientTarget | null): string | null {
  return target ? (target.kind === 'environment' ? target.environmentId : 'local') : null
}

function terminalTitle(state: AppState, worktreeId: string, tabId: string): string | undefined {
  const tab = state.tabsByWorktree[worktreeId]?.find((candidate) => candidate.id === tabId)
  return (tab?.customTitle || tab?.generatedTitle || tab?.title)?.trim() || undefined
}

/** The owner host's terminal agents, as the inputs the pure collector reads. */
function ownerTerminalRows(state: AppState, owner: string, now: number): UsageTerminalInput[] {
  const chatPanes = getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
  const rows: UsageTerminalInput[] = []
  for (const entry of state.agentStatusByPaneKey.values()) {
    // Why: chats and bots come from their host's status feed, which also lists tabless ones.
    if (entry.observation?.origin === 'structured' || chatPanes.has(entry.paneKey)) {
      continue
    }
    if (entry.agentType !== 'claude' && entry.agentType !== 'codex') {
      continue
    }
    const parsed = parsePaneKey(entry.paneKey)
    const tabId = entry.tabId ?? parsed?.tabId
    const worktreeId = entry.worktreeId
    if (!tabId || !worktreeId) {
      continue
    }
    const hostId = getAgentPaneExecutionHost(state, entry.paneKey, entry)
    const host = hostId && hostId !== 'foreign' ? runtimeRpcTargetForAuthorityKey(hostId) : null
    if (targetKey(host) !== owner) {
      continue
    }
    const ptyId = parsed
      ? state.terminalLayoutsByTabId[parsed.tabId]?.ptyIdsByLeafId?.[parsed.leafId]
      : undefined
    const hasLivePty = (state.ptyIdsByTabId[tabId]?.length ?? 0) > 0
    rows.push({
      paneKey: entry.paneKey,
      tabId,
      worktreeId,
      agentType: entry.agentType,
      rowState: resolveAgentRowState(entry, now, hasLivePty),
      stateStartedAt: entry.turnStartedAt ?? entry.stateStartedAt,
      updatedAt: entry.updatedAt,
      title:
        entry.orchestration?.displayName ||
        entry.orchestration?.taskTitle ||
        terminalTitle(state, worktreeId, tabId) ||
        entry.terminalTitle ||
        entry.agentType,
      ...(entry.model ? { model: entry.model } : {}),
      ...(ptyId && state.codexRestartNoticeByPtyId[ptyId]
        ? { restartNotice: state.codexRestartNoticeByPtyId[ptyId] }
        : {})
    })
  }
  return rows
}

type TerminalInputsMemo = { inputs: readonly unknown[]; key: string }
let terminalMemo: TerminalInputsMemo | null = null

/** The owner's terminal sessions as a comparable string; recomputed only when an input moved. */
function ownerTerminalSessionsKey(state: AppState, owner: string, now: number): string {
  const inputs = [
    owner,
    now,
    state.agentStatusByPaneKey,
    state.tabsByWorktree,
    state.unifiedTabsByWorktree,
    state.ptyIdsByTabId,
    state.terminalLayoutsByTabId,
    state.codexRestartNoticeByPtyId
  ]
  if (!terminalMemo || inputs.some((input, index) => input !== terminalMemo!.inputs[index])) {
    terminalMemo = {
      inputs,
      key: JSON.stringify(collectTerminalSessions(ownerTerminalRows(state, owner, now), now))
    }
  }
  return terminalMemo.key
}

/** Bumps on every change to the owner's chat statuses; the feed updates its map in place. */
function useChatFeedRevision(target: RuntimeClientTarget | null): number {
  const [revision, setRevision] = useState(0)
  const key = targetKey(target)
  useEffect(() => {
    if (!key) {
      return
    }
    const feed = getStructuredAgentSessionStatusFeed(
      key === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: key }
    )
    const release = feed.activate()
    const unsubscribe = feed.subscribe(() => setRevision((value) => value + 1))
    setRevision((value) => value + 1)
    return () => {
      unsubscribe()
      release()
    }
  }, [key])
  return revision
}

/** The owner's chats and bots; `_revision` names the feed state read, since its map updates in place. */
function readOwnerChatSessions(key: string, now: number, _revision: number): UsageAgentSession[] {
  const feed = getStructuredAgentSessionStatusFeed(
    key === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: key }
  )
  return collectChatSessions(
    [...feed.getSnapshot().values()].map((summary) => ({
      ...summary,
      title: summary.conversationName?.trim() || ''
    })),
    now
  )
}

/**
 * Every Claude and Codex agent on the host whose usage the bar shows: chats and bots from that
 * host's status feed, terminal agents (orchestration workers included) from agent status. Nothing
 * here polls; both are the feeds the sidebar already follows.
 */
export function useUsageAccountSessions(owner: RuntimeClientTarget | null): UsageAgentSession[] {
  const now = useNow(SESSION_CLOCK_MS)
  const key = targetKey(owner)
  const chatRevision = useChatFeedRevision(owner)
  // Why a string: agent status changes on every tool call; the bar redraws only when a row moves.
  const terminalsKey = useAppStore((state) =>
    key ? ownerTerminalSessionsKey(state, key, now) : ''
  )
  return useMemo(() => {
    const terminals: UsageAgentSession[] = terminalsKey ? JSON.parse(terminalsKey) : []
    return key ? [...readOwnerChatSessions(key, now, chatRevision), ...terminals] : terminals
  }, [terminalsKey, chatRevision, key, now])
}
