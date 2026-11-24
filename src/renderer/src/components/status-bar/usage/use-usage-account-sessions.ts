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

/** Each listed host's terminal agents, as the inputs the pure collector reads. */
function hostTerminalRows(
  state: AppState,
  hosts: readonly string[],
  now: number
): Map<string, UsageTerminalInput[]> {
  const chatPanes = getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
  const byHost = new Map<string, UsageTerminalInput[]>(hosts.map((host) => [host, []]))
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
    const rows = byHost.get(targetKey(host) ?? '')
    if (!rows) {
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
  return byHost
}

type TerminalInputsMemo = { inputs: readonly unknown[]; key: string }
let terminalMemo: TerminalInputsMemo | null = null

/** The hosts' terminal sessions as a comparable string; recomputed only when an input moved. */
function hostTerminalSessionsKey(state: AppState, hostsKey: string, now: number): string {
  const inputs = [
    hostsKey,
    now,
    state.agentStatusByPaneKey,
    state.tabsByWorktree,
    state.unifiedTabsByWorktree,
    state.ptyIdsByTabId,
    state.terminalLayoutsByTabId,
    state.codexRestartNoticeByPtyId
  ]
  if (!terminalMemo || inputs.some((input, index) => input !== terminalMemo!.inputs[index])) {
    const rows = hostTerminalRows(state, hostsKey.split('|'), now)
    terminalMemo = {
      inputs,
      key: JSON.stringify(
        Object.fromEntries(
          [...rows].map(([host, hostRows]) => [host, collectTerminalSessions(hostRows, now)])
        )
      )
    }
  }
  return terminalMemo.key
}

function feedFor(key: string) {
  return getStructuredAgentSessionStatusFeed(
    key === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: key }
  )
}

/** Opens each host's chat feed and calls back on its changes; returns the cleanup. */
function followChatFeeds(hostsKey: string, onChange: () => void): () => void {
  const feeds = hostsKey.split('|').map(feedFor)
  const releases = feeds.map((feed) => feed.activate())
  const unsubscribes = feeds.map((feed) => feed.subscribe(onChange))
  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe())
    releases.forEach((release) => release())
  }
}

/** Bumps on every change to the hosts' chat statuses; each feed updates its map in place. */
function useChatFeedRevision(hostsKey: string): number {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!hostsKey) {
      return
    }
    const bump = (): void => setRevision((value) => value + 1)
    const stop = followChatFeeds(hostsKey, bump)
    bump()
    return stop
  }, [hostsKey])
  return revision
}

/** A host's chats and bots; `_revision` names the feed state read, since its map updates in place. */
function readHostChatSessions(key: string, now: number, _revision: number): UsageAgentSession[] {
  return collectChatSessions(
    [...feedFor(key).getSnapshot().values()].map((summary) => ({
      ...summary,
      title: summary.conversationName?.trim() || ''
    })),
    now
  )
}

/**
 * Every Claude and Codex agent per host ('local' or an environment id): chats and bots from each
 * host's status feed, terminal agents (orchestration workers included) from agent status. Nothing
 * here polls; both are the feeds the sidebar already follows.
 */
export function useHostUsageSessions(hosts: readonly string[]): Map<string, UsageAgentSession[]> {
  const now = useNow(SESSION_CLOCK_MS)
  const hostsKey = hosts.join('|')
  const chatRevision = useChatFeedRevision(hostsKey)
  // Why a string: agent status changes on every tool call; the bar redraws only when a row moves.
  const terminalsKey = useAppStore((state) =>
    hostsKey ? hostTerminalSessionsKey(state, hostsKey, now) : ''
  )
  return useMemo(() => {
    const terminals: Record<string, UsageAgentSession[]> = terminalsKey
      ? JSON.parse(terminalsKey)
      : {}
    return new Map(
      (hostsKey ? hostsKey.split('|') : []).map((key) => [
        key,
        [...readHostChatSessions(key, now, chatRevision), ...(terminals[key] ?? [])]
      ])
    )
  }, [terminalsKey, chatRevision, hostsKey, now])
}

export { targetKey as usageHostKey }
