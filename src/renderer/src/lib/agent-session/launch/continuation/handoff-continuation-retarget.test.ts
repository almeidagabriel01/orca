import { describe, expect, it } from 'vitest'
import { retargetContinuationRequest } from './handoff-continuation-retarget'
import type { AgentSessionContinuationRequest } from '../../../../../../shared/agent-session/conversation-context/agent-session-continuation'

const request: AgentSessionContinuationRequest = {
  source: { sourceAgent: 'claude', capturedText: 'hi', transcriptPath: '/src/t.jsonl' },
  worktreeId: 'src',
  groupId: 'g1',
  workspacePath: '/src',
  initialCwd: '/src',
  launchSource: 'sidebar'
}
const dest = { worktreeId: 'dst', worktreePath: '/dst' }

describe('retargetContinuationRequest', () => {
  it('keeps a same-host request as is', () => {
    expect(retargetContinuationRequest(request, { ...dest, sameHost: true })).toBe(request)
  })
  it('moves to the destination and drops host-local pane and transcript', () => {
    const out = retargetContinuationRequest(request, { ...dest, sameHost: false })
    expect(out).toMatchObject({
      worktreeId: 'dst',
      workspacePath: '/dst',
      initialCwd: '/dst',
      groupId: null
    })
    expect(out.source.transcriptPath).toBeNull()
  })
})
