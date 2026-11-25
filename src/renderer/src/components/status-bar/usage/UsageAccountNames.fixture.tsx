import { defineFixture } from '../../../component-fixtures/component-fixture'
import {
  namedClaudeAccounts,
  namedCodexAccounts
} from '../../../component-fixtures/fixture-account-names'
import {
  getAccountDisplayName,
  getSystemDefaultDisplayName
} from '../../../../../shared/agent-accounts/managed-account-display-names'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { buildUsageRowChips, type UsageAccountEntry } from '../composition/status-bar-usage-chips'
import { ProviderSegment } from './StatusBarProviderSegment'
import { UsageUnitLabel } from './usage-unit-label'

const NOW = Date.now()
const HOUR = 60 * 60_000

function reading(
  provider: ProviderRateLimits['provider'],
  sessionUsed: number,
  weeklyUsed: number
): ProviderRateLimits {
  const win = (usedPercent: number, windowMinutes: number): RateLimitWindow => ({
    usedPercent,
    windowMinutes,
    resetsAt: NOW + 3 * HOUR,
    resetDescription: null
  })
  return {
    provider,
    session: win(sessionUsed, 300),
    weekly: win(weeklyUsed, 10_080),
    updatedAt: NOW,
    error: null,
    status: 'ok'
  }
}

const gestaoReading = reading('claude', 12, 40)
const gabrielReading = reading('claude', 63, 18)
const claudeGabriel = namedClaudeAccounts.accounts[0]!

/** Claude's entries in roster order (System default, then the saved one), as the status bar lists them. */
function chips(selected: 'system-default' | 'claude-gabriel') {
  const claude: UsageAccountEntry[] = [
    {
      key: 'system-default',
      selected: selected === 'system-default',
      reading: gestaoReading,
      name: {
        displayName: namedClaudeAccounts.systemDefaultDisplayName,
        email: namedClaudeAccounts.systemDefaultEmail
      }
    },
    {
      key: claudeGabriel.id,
      selected: selected === claudeGabriel.id,
      reading: gabrielReading,
      name: claudeGabriel
    }
  ]
  const codex: UsageAccountEntry[] = [
    {
      key: 'system-default',
      selected: true,
      reading: null,
      name: {
        displayName: namedCodexAccounts.systemDefaultDisplayName,
        email: namedCodexAccounts.systemDefault?.email
      }
    },
    {
      key: 'codex-ops',
      selected: false,
      reading: reading('codex', 5, 22),
      name: namedCodexAccounts.accounts[0]!
    }
  ]
  return buildUsageRowChips({
    providers: [
      selected === 'system-default' ? gestaoReading : gabrielReading,
      reading('codex', 30, 9)
    ],
    accounts: 'all',
    accountsByProvider: { claude, codex }
  })
}

function Bar({ selected }: { selected: 'system-default' | 'claude-gabriel' }) {
  return (
    <div className="flex h-[22px] items-center gap-3 whitespace-nowrap border-t border-border bg-sidebar px-2 text-xs">
      <UsageUnitLabel display="used" />
      {chips(selected).map((chip) => (
        <ProviderSegment
          key={chip.id}
          p={chip.p}
          accountLabel={chip.accountLabel}
          selected={chip.selected}
          compact
          display="used"
          mode="verbose"
        />
      ))}
    </div>
  )
}

/** Switching the selected Claude account keeps every chip where it was. */
export const fixedOrder = defineFixture({
  width: 1100,
  render: () => (
    <div className="flex flex-col gap-2 bg-background p-3 text-xs text-muted-foreground">
      <span>Selected: {getSystemDefaultDisplayName(namedClaudeAccounts)}</span>
      <Bar selected="system-default" />
      <span>Selected: {getAccountDisplayName(claudeGabriel)}</span>
      <Bar selected="claude-gabriel" />
    </div>
  )
})
