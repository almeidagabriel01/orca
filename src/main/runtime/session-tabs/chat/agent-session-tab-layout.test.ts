import { describe, expect, it } from 'vitest'
import { openAgentSessionTab } from '../../../../shared/workspace-layout/commands/workspace-layout-content-commands'
import type { LayoutContext } from '../../../../shared/workspace-layout/workspace-layout-command-types'
import type {
  LayoutTab,
  WorkspaceLayout,
  WorkspaceLayoutModel
} from '../../../../shared/workspace-layout/workspace-layout-model'
import { chatTabLayoutCommand } from './agent-session-tab-layout'

const chat = (id: string, sessionId: string, agent: string): LayoutTab => ({
  id,
  kind: 'agent-session',
  entityId: sessionId,
  createdAt: 1,
  customTitle: null,
  color: null,
  agentSessionAgent: agent
})

describe('chat tab agent switch', () => {
  it('keeps the chat in its own tab and place, now on the new agent', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a fixture with only the fields these commands read
    const workspace: WorkspaceLayout = {
      worktreeId: 'w',
      tabs: [chat('tab-a', 's-a', 'claude'), chat('tab-b', 's-b', 'claude')],
      groups: [{ id: 'g', tabOrder: ['tab-a', 'tab-b'] }]
    } as WorkspaceLayout
    const model = { workspaces: { w: workspace } } as unknown as WorkspaceLayoutModel
    const switched = { open: { sessionId: 's-a', agent: 'codex', tabId: 'tab-a' } }
    const command = chatTabLayoutCommand(workspace, 'g', 'w', switched)
    const result = openAgentSessionTab(
      model,
      command as never,
      {
        mintId: () => 'minted',
        now: () => 2
      } as unknown as LayoutContext
    )

    expect(result.ok && result.model.workspaces.w).toEqual({
      ...workspace,
      tabs: [chat('tab-a', 's-a', 'codex'), chat('tab-b', 's-b', 'claude')]
    })
    // A status echo of the same agent writes nothing.
    expect(result.ok && chatTabLayoutCommand(result.model.workspaces.w, 'g', 'w', switched)).toBe(
      null
    )
  })
})
