import { defineMethod } from '../../core'
import {
  toPairedMemoryReply,
  toPairedMemoryReplyWithChats
} from '../../../../memory/memory-snapshot-paired-reply'
import {
  DiagnosticsHeavyQueueActionParams,
  DiagnosticsHeavyQueueCountsParams,
  DiagnosticsMemoryParams,
  DiagnosticsProcessTreeParams
} from '../../../../../shared/rpc-contract/diagnostics-params'
import { collectSessionProcessTree } from '../../../../memory/session-process-tree'
import { readHeavyQueueCounts } from '../../../../memory/host-heavy-queue-counts'
import { runHeavyQueueAction } from '../../../../memory/host-heavy-command-queue-actions'

export const DIAGNOSTICS_METHODS = [
  defineMethod({
    name: 'diagnostics.memory',
    permission: 'workspace',
    params: DiagnosticsMemoryParams,
    handler: async ({ withChats }, { runtime, caller }) => {
      // Paired machines get terminals only unless they ask for chats, which older clients never do.
      const snapshot = await runtime.getMemorySnapshot()
      if (caller?.kind === 'local-cli' || caller?.kind === 'desktop') {
        return withChats ? { ...snapshot, chatsIncluded: true } : snapshot
      }
      return withChats ? toPairedMemoryReplyWithChats(snapshot) : toPairedMemoryReply(snapshot)
    }
  }),
  defineMethod({
    name: 'diagnostics.processTree',
    permission: 'workspace',
    params: DiagnosticsProcessTreeParams,
    handler: async ({ sessionId }, { runtime }) =>
      collectSessionProcessTree(sessionId, () => runtime.getMemorySnapshot())
  }),
  defineMethod({
    name: 'diagnostics.heavyQueueCounts',
    permission: 'workspace',
    params: DiagnosticsHeavyQueueCountsParams,
    handler: async () => ({ counts: await readHeavyQueueCounts() })
  }),
  defineMethod({
    name: 'diagnostics.heavyQueueAction',
    permission: 'workspace',
    params: DiagnosticsHeavyQueueActionParams,
    handler: async (action) => {
      await runHeavyQueueAction(action)
      return { ok: true }
    }
  })
]
