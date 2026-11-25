import { describe, expect, it } from 'vitest'
import { buildTabCreateMenuOptions } from '@/components/tab-bar/create-menu/tab-create-menu-options'
import { emptyWorkspaceSurfaceOptions } from './empty-workspace-surface-options'

describe('emptyWorkspaceSurfaceOptions', () => {
  it("offers only the + menu's items an empty workspace can open", () => {
    const menu = buildTabCreateMenuOptions({
      hasNewBrowser: true,
      hasNewMarkdown: true,
      hasOpenMarkdown: true,
      hasSimulator: true,
      simulatorIsGoTo: false,
      terminalOnly: false
    })
    expect(emptyWorkspaceSurfaceOptions(menu).map((option) => option.value)).toEqual([
      'new-terminal',
      'new-browser',
      'new-markdown',
      'new-simulator'
    ])
  })
})
