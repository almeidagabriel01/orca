import { describe, expect, it } from 'vitest'
import { parseWorkspaceSession } from '../../workspace-session/workspace-session-schema'
import { loadWorkspaceLayout } from '../persistence/workspace-layout-load'
import { nameBasedLoadContext } from '../persistence/workspace-layout-minted-ids'
import { saveWorkspaceLayout } from '../persistence/workspace-layout-save'
import { publishWorkspaceLayout } from '../published-layout/workspace-layout-published'
import { workspaceLayoutFromPublished } from '../published-layout/workspace-layout-from-published'
import { projectSessionTabs } from '../old-client/old-client-session-tabs-projection'
import { applyLayoutCommand } from '../workspace-layout-commands'
import {
  resolveWorkspaceSelection,
  emptyLayoutViewRecord
} from '../client-views/workspace-layout-views'
import type { WorkspaceLayoutModel } from '../workspace-layout-model'

const WT = 'repo-1::/home/user/project'

function chatTab(
  id: string,
  groupId: string,
  sortOrder: number,
  extra: { dock?: 'right-panel' } = {}
) {
  return {
    id,
    entityId: `session-${id}`,
    groupId,
    worktreeId: WT,
    contentType: 'agent-session',
    agentSessionAgent: 'claude',
    label: id,
    customLabel: null,
    color: null,
    sortOrder,
    createdAt: 1_700_000_000_000 + sortOrder,
    ...extra
  }
}

const context = {
  mintId: () => 'minted',
  mintLeafId: () => '00000000-0000-4000-8000-000000000001',
  now: () => 1
}

describe('tab dock', () => {
  it('survives session parse, load, save, publish and the window rebuild', () => {
    const parsed = parseWorkspaceSession({
      activeRepoId: null,
      activeWorktreeId: null,
      activeTabId: null,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {},
      unifiedTabs: {
        [WT]: [chatTab('a', 'g1', 0), chatTab('b', 'g1', 1, { dock: 'right-panel' })]
      },
      tabGroups: {
        [WT]: [{ id: 'g1', worktreeId: WT, activeTabId: 'a', tabOrder: ['a', 'b'] }]
      }
    })
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }
    const loaded = loadWorkspaceLayout('local', parsed.value, nameBasedLoadContext())
    const saved = saveWorkspaceLayout(loaded)
    expect(saved.unifiedTabs?.[WT]?.find((tab) => tab.id === 'b')?.dock).toBe('right-panel')
    expect(saved.unifiedTabs?.[WT]?.find((tab) => tab.id === 'a')?.dock).toBeUndefined()

    const [key, workspace] = Object.entries(loaded.layout.workspaces)[0]!
    // A paired host publishes it to remote clients; null tells them the tab is back in the center.
    const rows = projectSessionTabs(key, workspace, loaded.desktopView, loaded.facts, false).tabs
    expect(rows.map((row) => (row.type === 'agent-session' ? row.dock : 'not-a-chat'))).toEqual([
      null,
      'right-panel'
    ])
    const rebuilt = workspaceLayoutFromPublished(publishWorkspaceLayout(workspace, 'local'))
    expect(rebuilt.tabs.find((tab) => tab.id === 'b')?.dock).toBe('right-panel')
    expect(rebuilt.groups[0]?.tabOrder).toEqual(['a', 'b'])
  })

  it('never shows a docked tab and rehomes it when its group would hold only docked tabs', () => {
    const model: WorkspaceLayoutModel = {
      hostId: 'local',
      records: {},
      legacy: { terminalRowOwners: {} },
      workspaces: {
        [WT]: {
          worktreeId: WT,
          tabs: ['a', 'b', 'c'].map((id) => ({
            id,
            entityId: id,
            createdAt: 1,
            customTitle: null,
            color: null,
            kind: 'agent-session' as const
          })),
          groups: [
            { id: 'g1', tabOrder: ['a', 'b'] },
            { id: 'g2', tabOrder: ['c'] }
          ],
          groupLayout: {
            type: 'split',
            direction: 'horizontal',
            first: { type: 'leaf', groupId: 'g1' },
            second: { type: 'leaf', groupId: 'g2' }
          }
        }
      }
    }
    const docked = applyLayoutCommand(
      model,
      { type: 'setTabDock', workspace: WT, tabId: 'b', dock: 'right-panel' },
      context
    )
    if (!docked.ok) {
      throw new Error(docked.code)
    }
    const view = {
      ...emptyLayoutViewRecord(),
      groups: { [WT]: { g1: { activeTabId: 'b', recentTabIds: ['a', 'b'] } } }
    }
    const workspace = docked.model.workspaces[WT]!
    expect(resolveWorkspaceSelection(view, WT, workspace).groups.g1?.activeTabId).toBe('a')

    const alone = applyLayoutCommand(
      docked.model,
      { type: 'setTabDock', workspace: WT, tabId: 'c', dock: 'right-panel' },
      context
    )
    if (!alone.ok) {
      throw new Error(alone.code)
    }
    expect(alone.model.workspaces[WT]!.groups).toEqual([{ id: 'g1', tabOrder: ['a', 'b', 'c'] }])
    expect(alone.model.workspaces[WT]!.tabs.map((tab) => tab.dock)).toEqual([
      undefined,
      'right-panel',
      'right-panel'
    ])
  })
})
