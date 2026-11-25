import { decideAgentLaunchIntentMode } from '../../../../agent-launch/agent-launch-intent-mode'
/** Resolve selectors and validate terminal reuse without creating a surface. */

import type {
  AgentLaunchIntent,
  AgentLaunchTarget,
  AgentLaunchModeReceipt
} from '../../../../../shared/agent-launch/contracts/agent-launch-intent'
import type { OrcaRuntimeService } from '../../../orca-runtime'
import { assertTerminalLaunchAdmissible } from '../../../../agent-launch/agent-launch-surface-factories'
import type { AgentLaunchParams } from '../../../../../shared/rpc-contract/agent-launch/agent-launch-params'
import { resolveAgentLaunchModeOnHost } from '../../../../agent-launch/agent-launch-mode'
import { readLaunchProject } from '../../../../agent-launch/agent-launch-mode-settings'
import { worktreeCreateRepoSelector } from '../workspaces/worktree-create-args'

import type { EarlyAgentLaunchTab } from './agent-launch-tab-publication'

type LaunchProject = Awaited<ReturnType<typeof readLaunchProject>>

type ResolvedAgentLaunchIntent = Omit<AgentLaunchIntent, 'sessionOptions'> & {
  sessionOptions?: Readonly<NonNullable<AgentLaunchParams['sessionOptions']>>
}

/** Resolve the selector once to avoid id:id: prefixes below the executor.
 * Use launch scope: floating workspaces have no Git worktree record, and folder rows are synthetic. */
async function agentLaunchTarget(
  params: AgentLaunchParams,
  runtime: Pick<OrcaRuntimeService, 'showTerminalWorkspaceLaunchScope' | 'showRepo'>
): Promise<{ target: AgentLaunchTarget; project: LaunchProject }> {
  if (params.target.kind !== 'existing') {
    return {
      target: { kind: params.target.kind, create: { ...params.target.create } },
      project:
        params.target.kind === 'create-worktree'
          ? await readLaunchProject(runtime, {
              repo: worktreeCreateRepoSelector(params.target.create)
            })
          : null
    }
  }
  const workspace = await runtime.showTerminalWorkspaceLaunchScope(params.target.worktree)
  return {
    target: {
      kind: 'existing',
      worktree: workspace.id,
      workspacePath: workspace.path,
      connectionId: workspace.connectionId
    },
    project: workspace.repo
  }
}

function agentLaunchIntent(
  params: AgentLaunchParams,
  /** The pane of a tab already shown for this launch; the spawn must land in it. */
  publishedPaneKey: string | undefined,
  target: AgentLaunchTarget
): ResolvedAgentLaunchIntent {
  const paneKey = publishedPaneKey ?? params.paneKey
  return {
    agent: params.agent,
    target,
    ...(params.prompt ? { prompt: params.prompt } : {}),
    ...(params.sessionOptions ? { sessionOptions: params.sessionOptions } : {}),
    ...(params.chatOptions ? { chatOptions: params.chatOptions } : {}),
    ...(params.reuseTerminal ? { reuseTerminal: params.reuseTerminal } : {}),
    // `null` means "no arguments" and must survive; only absence falls back to the settings default.
    ...(params.agentArgs !== undefined ? { agentArgs: params.agentArgs } : {}),
    ...(params.cwd ? { cwd: params.cwd } : {}),
    ...(params.launchSource ? { launchSource: params.launchSource } : {}),
    ...(paneKey ? { paneKey } : {}),
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    ...(params.accountEnv ? { accountEnv: params.accountEnv } : {}),
    ...(params.nativeChatDefault !== undefined
      ? { nativeChatDefault: params.nativeChatDefault }
      : {}),
    ...(params.surface ? { surface: params.surface } : {})
  }
}

async function validateReusedTerminal(
  intent: AgentLaunchIntent,
  runtime: Pick<OrcaRuntimeService, 'showTerminal' | 'isTerminalRunningAgent'>
): Promise<void> {
  if (!intent.reuseTerminal) {
    return
  }
  if (intent.target.kind !== 'existing') {
    throw new Error('agent_launch_reuse_requires_existing_workspace')
  }
  const terminal = await runtime.showTerminal(intent.reuseTerminal.handle)
  if (terminal.worktreeId !== intent.target.worktree) {
    throw new Error('agent_launch_terminal_worktree_mismatch')
  }
  if (!(await runtime.isTerminalRunningAgent(intent.reuseTerminal.handle))) {
    throw new Error('agent_launch_terminal_not_running_agent')
  }
}

/** Resolve and validate before creation so a throw proves failed rather than unknown in the ledger. */
export async function resolveUnlaunchedIntent(
  params: AgentLaunchParams,
  runtime: OrcaRuntimeService,
  early: EarlyAgentLaunchTab | null,
  modeOptions: { terminalOnly?: boolean; callerRendersStructured?: boolean } = {}
): Promise<{ intent: ResolvedAgentLaunchIntent; decidedMode: AgentLaunchModeReceipt }> {
  const { target, project } = await agentLaunchTarget(params, runtime)
  const intent = agentLaunchIntent(params, early?.paneKey, target)
  await validateReusedTerminal(intent, runtime)
  const preflight = decideAgentLaunchIntentMode({ intent, runtime, project, ...modeOptions })
  const decidedMode =
    intent.target.kind === 'existing'
      ? await resolveAgentLaunchModeOnHost(
          runtime,
          preflight,
          intent.target.worktree,
          intent.agent,
          undefined,
          {
            phase: 'before-effects',
            agent: intent.agent,
            workspacePath: intent.target.workspacePath,
            cwd: intent.cwd
          }
        )
      : preflight
  assertTerminalLaunchAdmissible(intent, decidedMode.mode)
  return { intent, decidedMode }
}
