import type { AgentSessionContinuationRequest } from '../../../../../../shared/agent-session/conversation-context/agent-session-continuation'

/** Point a continuation at another workspace; across hosts the source pane/transcript do not exist there. */
export function retargetContinuationRequest(
  request: AgentSessionContinuationRequest,
  destination: { worktreeId: string; worktreePath: string; sameHost: boolean }
): AgentSessionContinuationRequest {
  if (destination.sameHost) {
    return request
  }
  return {
    ...request,
    worktreeId: destination.worktreeId,
    workspacePath: destination.worktreePath,
    initialCwd: destination.worktreePath,
    groupId: null,
    source: { ...request.source, transcriptPath: null }
  }
}
