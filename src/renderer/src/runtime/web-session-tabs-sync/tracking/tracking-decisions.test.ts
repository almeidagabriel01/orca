import { describe, expect, it } from 'vitest'
import { shouldBootstrapInitialWebRuntimeTerminal } from './tracking-decisions'
import type { SessionTabsStreamEvent } from '../state'

// A reopened workspace on a paired host (e.g. a VPS folder workspace) whose tabs were all closed.
const emptyHostAnswer: SessionTabsStreamEvent = {
  type: 'snapshot',
  worktree: 'folder:vps-home',
  publicationEpoch: 'epoch-1',
  snapshotVersion: 3,
  activeGroupId: null,
  activeTabId: null,
  activeTabType: null,
  tabs: []
}

const reopened = {
  event: emptyHostAnswer,
  activeWorktreeId: 'folder:vps-home',
  requestedInitialTerminal: false,
  snapshotIsFresh: true,
  localTerminalCount: 0,
  hasPersistedTerminalState: true,
  firstHostAnswer: true
}

describe('shouldBootstrapInitialWebRuntimeTerminal', () => {
  it('opens the empty workspace again when the user just opened it', () => {
    expect(
      shouldBootstrapInitialWebRuntimeTerminal({ ...reopened, userOpenedWorktree: true })
    ).toBe(true)
  })

  it('keeps a last-tab close when nobody opened the workspace', () => {
    expect(
      shouldBootstrapInitialWebRuntimeTerminal({ ...reopened, userOpenedWorktree: false })
    ).toBe(false)
  })

  it('never seeds beside a surface that is already requested or present', () => {
    expect(
      shouldBootstrapInitialWebRuntimeTerminal({
        ...reopened,
        userOpenedWorktree: true,
        requestedInitialTerminal: true
      })
    ).toBe(false)
    expect(
      shouldBootstrapInitialWebRuntimeTerminal({
        ...reopened,
        userOpenedWorktree: true,
        localTerminalCount: 1
      })
    ).toBe(false)
  })
})
