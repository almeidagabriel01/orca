import { defineFixture } from '../../../component-fixtures/component-fixture'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import { buildUsageRowChips, type UsageAccountEntry } from '../composition/status-bar-usage-chips'
import { ProviderSegment } from './StatusBarProviderSegment'
import { UsageRosterPanel } from './UsageRosterPanel'
import { ProviderDetailsMenu } from './ProviderDetailsMenu'
import { UsageUnitLabel } from './usage-unit-label'

const NOW = Date.now()
const HOUR = 60 * 60_000
const DAY = 24 * HOUR

function win(usedPercent: number, windowMinutes: number, resetsInMs: number): RateLimitWindow {
  return { usedPercent, windowMinutes, resetsAt: NOW + resetsInMs, resetDescription: null }
}

function reading(
  provider: ProviderRateLimits['provider'],
  fields: Partial<ProviderRateLimits>
): ProviderRateLimits {
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: NOW,
    error: null,
    status: 'ok',
    ...fields
  }
}

const claudeWork = reading('claude', {
  planType: 'max_20x',
  session: win(7, 300, 3 * HOUR + 46 * 60_000),
  weekly: win(41, 10_080, 5 * DAY + 10 * HOUR),
  fableWeekly: win(0, 10_080, 5 * DAY + 10 * HOUR)
})
const claudeSide = reading('claude', {
  planType: 'max_5x',
  session: win(0, 300, 4 * HOUR),
  weekly: win(78, 10_080, 2 * DAY + 9 * HOUR),
  fableWeekly: win(92, 10_080, 2 * DAY + 9 * HOUR)
})
const codexAlpha = reading('codex', {
  planType: 'pro',
  session: win(18, 300, 2 * HOUR),
  weekly: win(33, 10_080, 6 * DAY)
})
const codexBeta = reading('codex', {
  planType: 'plus',
  session: win(64, 300, HOUR),
  weekly: win(12, 10_080, 3 * DAY)
})
const grok = reading('grok', { weekly: win(39, 10_080, 6 * DAY) })

// Two Claude and two Codex accounts, one Codex never read, plus a single-login provider.
const CHIPS = buildUsageRowChips({
  providers: [claudeWork, codexAlpha, grok],
  accounts: 'all',
  accountsByProvider: {
    claude: [
      {
        key: 'work',
        selected: true,
        reading: null,
        name: { displayName: 'Work', email: 'me@work.dev' }
      },
      { key: 'side', selected: false, reading: claudeSide, name: { email: 'gabriel@side.dev' } }
    ],
    codex: [
      { key: 'alpha', selected: true, reading: null, name: { email: 'dev@alpha.io' } },
      { key: 'beta', selected: false, reading: codexBeta, name: { email: 'dev@beta.io' } },
      { key: 'gamma', selected: false, reading: null, name: { email: 'ops@gamma.io' } }
    ] satisfies UsageAccountEntry[]
  }
})

const noop = (): void => {}

function Bar({ mode, compact = false }: { mode: StatusBarUsageMode; compact?: boolean }) {
  return (
    <div className="flex h-[22px] items-center gap-3 whitespace-nowrap border-t border-border bg-sidebar px-2 text-xs">
      <UsageUnitLabel display="used" />
      {CHIPS.map((chip) => (
        <ProviderSegment
          key={chip.id}
          p={chip.p}
          accountLabel={chip.accountLabel}
          selected={chip.selected}
          compact={compact}
          display="used"
          mode={mode}
        />
      ))}
    </div>
  )
}

export const statusBar = defineFixture({
  width: 1000,
  render: () => (
    <div className="flex flex-col gap-2 bg-background p-3 text-xs text-muted-foreground">
      <span>Detailed</span>
      <Bar mode="verbose" />
      <span>Detailed, narrow</span>
      <Bar mode="verbose" compact />
      <span>Compact</span>
      <Bar mode="compact" compact />
    </div>
  )
})

function popover(mode: StatusBarUsageMode) {
  return defineFixture({
    width: 480,
    store: { statusBarUsageMode: mode, statusBarUsageAccounts: 'all' },
    render: () => (
      <div className="h-[620px] bg-background p-3">
        <DropdownMenu defaultOpen modal={false}>
          <DropdownMenuTrigger>Usage</DropdownMenuTrigger>
          <DropdownMenuContent align="start" variant="picker" className="w-[440px]">
            <UsageRosterPanel
              providers={[claudeWork, codexAlpha, grok]}
              accountRows={CHIPS}
              display="used"
              statusBarUsageMode={mode}
              onStatusBarUsageModeChange={noop}
              usageAccounts="all"
              onUsageAccountsChange={noop}
              isRefreshing={false}
              onRefresh={noop}
              onOpenProvider={noop}
              onSignIn={noop}
              canSignIn={() => false}
              onManageAccounts={noop}
              onUsageDetails={noop}
              renderRow={(p, row, entry) => (
                <ProviderDetailsMenu
                  provider={p}
                  asSubmenu
                  triggerContent={row}
                  variant="account"
                  accountLabel={entry.accountLabel}
                  ariaLabel="Open usage details"
                />
              )}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  })
}

export const popoverDetailed = popover('verbose')
export const popoverCompact = popover('compact')
