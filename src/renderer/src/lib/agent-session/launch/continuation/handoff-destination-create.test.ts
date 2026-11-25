import { describe, expect, it } from 'vitest'
import {
  handoffCreateFailureMessage,
  handoffWorkspaceCreateArgs
} from './handoff-destination-create'

describe('handoffWorkspaceCreateArgs', () => {
  it('bases the workspace on the pushed upstream and pins the same branch name', () => {
    expect(handoffWorkspaceCreateArgs('feat/mobile-app', 'fork/feat/mobile-app')).toEqual({
      name: 'feat/mobile-app',
      baseBranch: 'fork/feat/mobile-app',
      branchNameOverride: 'feat/mobile-app'
    })
  })

  it('falls back to origin when the upstream is missing or tracks another branch name', () => {
    expect(handoffWorkspaceCreateArgs('feat/x', undefined).baseBranch).toBe('origin/feat/x')
    expect(handoffWorkspaceCreateArgs('feat/x', 'origin/other').baseBranch).toBe('origin/feat/x')
  })
})

describe('handoffCreateFailureMessage', () => {
  it('turns a git fetch failure into a plain sentence', () => {
    expect(
      handoffCreateFailureMessage(
        'feat/mobile-app',
        'Could not refresh base ref "origin/feat/mobile-app" from "origin".'
      )
    ).toBe("Couldn't fetch feat/mobile-app from GitHub. Check the connection and try again.")
  })
})
