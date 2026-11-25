import { defineMethod } from '../../core'
import {
  toPairedMemoryReply,
  toPairedMemoryReplyWithChats
} from '../../../../memory/memory-snapshot-paired-reply'
import {
  DiagnosticsHeavyJobMoveSourceParams,
  DiagnosticsHeavyJobTargetParams,
  DiagnosticsHeavyQueueActionParams,
  DiagnosticsMemoryParams,
  DiagnosticsProcessTreeParams
} from '../../../../../shared/rpc-contract/diagnostics-params'
import { collectSessionProcessTree } from '../../../../memory/session-process-tree'
import { runHeavyQueueAction } from '../../../../memory/host-heavy-command-queue-actions'
import { collectHeavyCommandQueue } from '../../../../memory/host-heavy-command-queue'
import {
  checkHeavyJobTarget,
  createHeavyJobMoveDeps,
  describeHeavyJobForMove,
  localRepos
} from '../../../../memory/host-heavy-job-move'

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
    name: 'diagnostics.heavyQueueAction',
    permission: 'workspace',
    params: DiagnosticsHeavyQueueActionParams,
    handler: async (action) => {
      await runHeavyQueueAction(action)
      return { ok: true }
    }
  }),
  defineMethod({
    name: 'diagnostics.heavyQueue',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => collectHeavyCommandQueue(runtime.requireStore())
  }),
  defineMethod({
    name: 'diagnostics.heavyJobMoveSource',
    permission: 'workspace',
    params: DiagnosticsHeavyJobMoveSourceParams,
    handler: async ({ pid }, { runtime }) =>
      describeHeavyJobForMove(
        pid,
        createHeavyJobMoveDeps(() => localRepos(runtime.requireStore().getRepos()))
      )
  }),
  defineMethod({
    name: 'diagnostics.heavyJobTargetCheck',
    permission: 'workspace',
    params: DiagnosticsHeavyJobTargetParams,
    handler: async (request, { runtime }) =>
      checkHeavyJobTarget(
        request,
        createHeavyJobMoveDeps(() => localRepos(runtime.requireStore().getRepos()))
      )
  })
]
