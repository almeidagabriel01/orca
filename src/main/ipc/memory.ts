import { BrowserWindow, ipcMain } from 'electron'
import type {
  MemorySnapshot,
  SessionProcessTree
} from '../../shared/diagnostics/process-stats-types'
import type { Store } from '../persistence/loading-store/store'
import { collectMemorySnapshot } from '../memory/collector'
import { collectSessionProcessTree } from '../memory/session-process-tree'
import { runHeavyQueueAction } from '../memory/host-heavy-command-queue-actions'
import {
  DiagnosticsHeavyJobMoveSourceParams,
  DiagnosticsHeavyJobTargetParams,
  DiagnosticsHeavyQueueActionParams
} from '../../shared/rpc-contract/diagnostics-params'
import type {
  HeavyJobMoveSource,
  HeavyJobTargetCheck
} from '../../shared/diagnostics/heavy-job-move-types'
import {
  checkHeavyJobTarget,
  createHeavyJobMoveDeps,
  describeHeavyJobForMove,
  localRepos
} from '../memory/host-heavy-job-move'
import { countHiddenBrowserPages, readPerfNoticeSignals } from '../perf-notices/perf-notice-signals'

import {
  assertResourceViewVisible,
  isResourceWindowVisible
} from '../window/visibility/resource-view-admission'
import type { ResourceViewAdmission } from '../../shared/diagnostics/resource-view-admission'

export function registerMemoryHandlers(store: Store): void {
  ipcMain.handle(
    'memory:getSnapshot',
    (event, admission?: ResourceViewAdmission): Promise<MemorySnapshot> => {
      assertResourceViewVisible(event, admission)
      return collectMemorySnapshot(store)
    }
  )
  ipcMain.handle(
    'memory:getProcessTree',
    (
      event,
      sessionId: unknown,
      admission?: ResourceViewAdmission
    ): Promise<SessionProcessTree | null> => {
      assertResourceViewVisible(event, admission)
      if (typeof sessionId !== 'string' || !sessionId) {
        return Promise.resolve(null)
      }
      return collectSessionProcessTree(sessionId, () => collectMemorySnapshot(store))
    }
  )
  ipcMain.handle(
    'memory:heavyQueueAction',
    (event, action: unknown, admission?: ResourceViewAdmission): Promise<void> => {
      assertResourceViewVisible(event, admission)
      return runHeavyQueueAction(DiagnosticsHeavyQueueActionParams.parse(action))
    }
  )
  const moveDeps = createHeavyJobMoveDeps(() => localRepos(store.getRepos()))
  ipcMain.handle(
    'memory:heavyJobMoveSource',
    (event, pid: unknown, admission?: ResourceViewAdmission): Promise<HeavyJobMoveSource> => {
      assertResourceViewVisible(event, admission)
      return describeHeavyJobForMove(
        DiagnosticsHeavyJobMoveSourceParams.parse({ pid }).pid,
        moveDeps
      )
    }
  )
  ipcMain.handle(
    'memory:heavyJobTargetCheck',
    (event, request: unknown, admission?: ResourceViewAdmission): Promise<HeavyJobTargetCheck> => {
      assertResourceViewVisible(event, admission)
      return checkHeavyJobTarget(DiagnosticsHeavyJobTargetParams.parse(request), moveDeps)
    }
  )
  ipcMain.handle('memory:readPerfNoticeSignals', () => readPerfNoticeSignals(store))
  ipcMain.handle('memory:countHiddenBrowserPages', (_event, hiddenForMs: unknown) =>
    countHiddenBrowserPages(typeof hiddenForMs === 'number' ? hiddenForMs : 0)
  )
  ipcMain.handle('memory:resourceWindowVisible', (event) =>
    isResourceWindowVisible(BrowserWindow.fromWebContents(event.sender))
  )
}
