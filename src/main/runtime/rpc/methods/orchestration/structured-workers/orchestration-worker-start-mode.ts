/** Reuse shared agent-launch-mode; orchestration contributes only worker/--terminal vocabulary for its established receipts. */

import {
  decideAgentLaunchMode,
  downgradeAgentLaunchModeForHost,
  resolveAgentLaunchModeOnHost,
  type AgentLaunchModeSettings,
  type AgentLaunchSupportPlace,
  type AgentLaunchModeVocabulary
} from '../../../../../agent-launch/agent-launch-mode'
import { readAgentLaunchModeSettings } from '../../../../../agent-launch/agent-launch-mode-settings'

import type { AgentLaunchModeReceipt } from '../../../../../../shared/agent-launch/contracts/agent-launch-intent'
import type { AgentLaunchSurface } from '../../../../../../shared/agent-launch/contracts/agent-launch-surface'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import type { OrcaRuntimeService } from '../../../../orca-runtime'

type WorkerStartModeReceipt = AgentLaunchModeReceipt

/** Keep orchestration's exact worker/reused-terminal wording; receipts are read beside dispatch records. */
export const WORKER_START_VOCABULARY: AgentLaunchModeVocabulary = {
  structured: 'a structured chat session worker',
  terminal: 'a terminal agent worker',
  detailOverrides: {
    remote_execution_host: 'this worker runs on a remote execution host',
    reused_terminal: '--terminal reuses a running terminal agent'
  }
}

/** Keep worktree/model/effort visible as considered inputs even though they no longer force terminal mode. */
type WorkerStartModePlacement = {
  agent?: string
  on?: string
  terminal?: string
  worktree?: string
  model?: string
  effort?: string
}

export function decideWorkerStartMode(args: {
  params: WorkerStartModePlacement & { surface?: AgentLaunchSurface }
  settings: AgentLaunchModeSettings | null | undefined
  /** The caller's lineage starts its workers as chats, whatever the settings say. */
  chatLineage?: boolean
}): WorkerStartModeReceipt {
  return decideAgentLaunchMode({
    placement: args.params,
    settings: args.settings,
    chatLineage: args.chatLineage,
    ...(args.params.surface ? { surface: args.params.surface } : {}),
    vocabulary: WORKER_START_VOCABULARY
  })
}

export async function resolveWorkerStartModeOnHost(
  runtime: Pick<OrcaRuntimeService, 'getStructuredAgentSessionCreateSupport'>,
  mode: WorkerStartModeReceipt,
  place: AgentLaunchSupportPlace | undefined,
  agent: TuiAgent | undefined
): Promise<WorkerStartModeReceipt> {
  return resolveAgentLaunchModeOnHost(runtime, mode, place, agent, WORKER_START_VOCABULARY)
}

export function downgradeWorkerStartModeForHost(
  receipt: WorkerStartModeReceipt,
  support: { supported: boolean; reason?: 'agent' | 'remote' | 'wsl' } | null
): WorkerStartModeReceipt {
  return downgradeAgentLaunchModeForHost(receipt, support, WORKER_START_VOCABULARY)
}

export function readWorkerStartModeSettings(
  runtime: Parameters<typeof readAgentLaunchModeSettings>[0],
  project?: Parameters<typeof readAgentLaunchModeSettings>[2]
): AgentLaunchModeSettings | null {
  return readAgentLaunchModeSettings(runtime, undefined, project)
}
