import os from 'node:os'
import { runProcess } from '@orca/process-host'
import type { HeavyQueueAction } from '../../shared/rpc-contract/diagnostics-params'
import {
  findHeavyQueueScript,
  sampleHeavyCommandQueue,
  supportsHeavyQueueControls
} from './host-heavy-command-queue'

const ACTION_TIMEOUT_MS = 10_000
const MAX_ERROR_CHARS = 300

export function heavyQueueActionArgs(action: HeavyQueueAction): string[] {
  switch (action.action) {
    case 'move':
      return ['move', String(action.pid), action.to]
    case 'run-now':
      return ['run-now', String(action.pid), ...(action.extra ? ['--extra'] : [])]
    case 'cancel':
      return ['cancel', String(action.pid)]
    case 'stop':
      return ['stop', String(action.pid)]
    case 'slots':
      return ['slots', String(action.slots)]
    case 'move-host':
      return ['move-host', String(action.pid), action.peer, action.cwd]
  }
}

/** Runs one control through the host's own script; rejects with its message when it refuses. */
export async function runHeavyQueueAction(action: HeavyQueueAction): Promise<void> {
  const script = supportsHeavyQueueControls(process.platform)
    ? await findHeavyQueueScript(os.homedir(), process.env.PATH)
    : null
  if (!script) {
    throw new Error('heavy_queue_unavailable')
  }
  if (action.action === 'move-host') {
    const queue = await sampleHeavyCommandQueue()
    if (!queue?.peers?.some((peer) => peer.alias === action.peer)) {
      throw new Error('heavy_queue_unknown_peer')
    }
  }
  const result = await runProcess({
    program: script,
    args: heavyQueueActionArgs(action),
    timeoutMs: ACTION_TIMEOUT_MS,
    maxOutputBytes: 64 * 1024
  })
  // The next Resource Manager poll reads the queue again instead of a cached one.
  sampleHeavyCommandQueue.invalidate()
  if (result.code !== 0 || result.timedOut) {
    throw new Error(result.stderr.trim().slice(0, MAX_ERROR_CHARS) || 'heavy_queue_action_failed')
  }
}
