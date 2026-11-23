import { defineMethod } from '../../core'
import { toPairedMemoryReply } from '../../../../memory/memory-snapshot-paired-reply'
import { DiagnosticsProcessTreeParams } from '../../../../../shared/rpc-contract/diagnostics-params'
import { collectSessionProcessTree } from '../../../../memory/session-process-tree'

export const DIAGNOSTICS_METHODS = [
  defineMethod({
    name: 'diagnostics.memory',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime, caller }) => {
      // Paired machines get terminals only, as before; chat detail stays on this machine for now.
      const snapshot = await runtime.getMemorySnapshot()
      return caller?.kind === 'local-cli' || caller?.kind === 'desktop'
        ? snapshot
        : toPairedMemoryReply(snapshot)
    }
  }),
  defineMethod({
    name: 'diagnostics.processTree',
    permission: 'workspace',
    params: DiagnosticsProcessTreeParams,
    handler: async ({ sessionId }, { runtime }) =>
      collectSessionProcessTree(sessionId, () => runtime.getMemorySnapshot())
  })
]
