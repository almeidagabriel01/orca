// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import { EmptyWorkspaceSurfaceView } from './EmptyWorkspaceSurfaceSection'

afterEach(cleanup)

function view(overrides: Partial<GlobalSettings>, updateSettings = vi.fn()) {
  render(
    <EmptyWorkspaceSurfaceView
      settings={{ ...getDefaultSettings('/home/test'), ...overrides }}
      updateSettings={updateSettings}
      simulatorAvailable={false}
    />
  )
  return updateSettings
}

const openAs = (): HTMLElement => screen.getByRole('radiogroup', { name: 'Open as' })
const checked = (): string | null =>
  openAs().querySelector('[aria-checked="true"]')?.textContent ?? null

describe('Opening a workspace with no tabs: Open as', () => {
  it('follows Open agents as until the user chooses', () => {
    view({ emptyWorkspaceSurface: 'agent:claude', agentDefaultSurface: 'chat' })
    expect(checked()).toBe('Chat')
    cleanup()
    view({ emptyWorkspaceSurface: 'agent:claude', agentDefaultSurface: 'terminal' })
    expect(checked()).toBe('Terminal')
  })

  it('shows the saved choice over Open agents as and saves a new one with the agent', () => {
    const update = view({
      emptyWorkspaceSurface: 'agent:claude',
      emptyWorkspaceAgentSurface: 'terminal',
      agentDefaultSurface: 'chat'
    })
    expect(checked()).toBe('Terminal')
    fireEvent.click(screen.getByRole('radio', { name: 'Chat' }))
    // An older `agent:<id>` is saved back as the default agent; its id never picked the agent.
    expect(update).toHaveBeenCalledWith({
      emptyWorkspaceSurface: 'default-agent',
      emptyWorkspaceAgentSurface: 'chat'
    })
  })

  it('shows an older agent:<id> as the default agent, not that agent', () => {
    view({ emptyWorkspaceSurface: 'agent:codex' })
    expect(
      screen.getByRole('button', { name: 'Opening a workspace with no tabs' }).textContent
    ).toBe('Default agent')
  })

  it('has no Open as row for a + menu item or nothing', () => {
    view({ emptyWorkspaceSurface: 'new-browser' })
    expect(screen.queryByRole('radiogroup', { name: 'Open as' })).toBeNull()
    cleanup()
    view({ emptyWorkspaceSurface: 'nothing' })
    expect(screen.queryByRole('radiogroup', { name: 'Open as' })).toBeNull()
  })
})
