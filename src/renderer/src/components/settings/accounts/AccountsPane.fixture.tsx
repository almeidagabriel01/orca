import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import { AccountsPane } from './AccountsPane'

// A host with Claude and Gemini only: no Codex, no agy, no Grok, Cursor, OpenCode or Devin.
const INSTALLED = ['claude', 'gemini']

function seedInventory(): void {
  window.api = {
    ...window.api,
    preflight: {
      ...window.api.preflight,
      detectAgents: async () => INSTALLED
    }
  }
}

// The shot tool captures one 900px viewport, so the screen comes in consecutive slices.
const SLICE = 860

function slice(index: number) {
  return defineFixture({
    width: 860,
    setup: seedInventory,
    render: () => (
      <div className="overflow-hidden bg-background px-6" style={{ height: SLICE }}>
        <div style={{ marginTop: -index * SLICE }} className="py-6">
          <AccountsPane
            settings={getDefaultSettings('/home/dev')}
            updateSettings={() => {}}
            updateSettingsOrThrow={() => {}}
            hostScope={{ target: { kind: 'local' }, available: true }}
          />
        </div>
      </div>
    )
  })
}

export const hostWithoutCodexOrAgy1 = slice(0)
export const hostWithoutCodexOrAgy2 = slice(1)
export const hostWithoutCodexOrAgy3 = slice(2)
export const hostWithoutCodexOrAgy4 = slice(3)
