import { describe, expect, it } from 'vitest'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { buildUsageRowChips, type UsageAccountEntry } from './status-bar-usage-chips'
import { type AccountReadingMemory, withRememberedAccountReadings } from './usage-account-memory'

const week = (usedPercent: number) => ({
  usedPercent,
  windowMinutes: 10_080,
  resetsAt: 9_000_000,
  resetDescription: null
})

const reading = (weekly: number, updatedAt: number): ProviderRateLimits => ({
  provider: 'claude',
  session: { ...week(19), windowMinutes: 300 },
  weekly: week(weekly),
  updatedAt,
  error: null,
  status: 'ok'
})

// What a host that never ran Claude with this login reports: no numbers, "Updates when Claude runs".
const neverRan: ProviderRateLimits = {
  provider: 'claude',
  session: null,
  weekly: null,
  updatedAt: 0,
  error: 'stale',
  status: 'error',
  usageMetadata: { failureKind: 'stale-token' }
} as ProviderRateLimits

function hostChips(gabriel: ProviderRateLimits, gestao: ProviderRateLimits) {
  const entries: UsageAccountEntry[] = [
    { key: 'a', selected: true, reading: null, name: { email: 'Gabriel@Example.com' } },
    { key: 'b', selected: false, reading: gestao, name: { email: 'gestao@example.com' } }
  ]
  return buildUsageRowChips({
    providers: [gabriel],
    accounts: 'all',
    accountsByProvider: { claude: entries }
  })
}

const weekly = (chips: ReturnType<typeof hostChips>) =>
  chips.map((chip) => chip.p.weekly?.usedPercent)

describe('usage readings follow the account across hosts', () => {
  it('keeps the account reading when the workspace moves to a host that never ran it', () => {
    const memory: AccountReadingMemory = new Map()
    const vps = withRememberedAccountReadings(hostChips(reading(84, 100), reading(32, 100)), memory)
    expect(weekly(vps)).toEqual([84, 32])
    const mac = withRememberedAccountReadings(hostChips(neverRan, reading(32, 100)), memory)
    expect(weekly(mac)).toEqual([84, 32])
    expect(mac[0]!.p.status).toBe('ok')
  })

  it('takes the newest reading any host brings, and leaves an account no host has read alone', () => {
    const memory: AccountReadingMemory = new Map()
    withRememberedAccountReadings(hostChips(reading(84, 100), neverRan), memory)
    const later = withRememberedAccountReadings(hostChips(reading(86, 200), neverRan), memory)
    expect(weekly(later)).toEqual([86, undefined])
    expect(later[1]!.p.status).toBe('error')
    // An older reading from a host that read the account earlier never wins over the newer one.
    const older = withRememberedAccountReadings(hostChips(reading(80, 150), neverRan), memory)
    expect(weekly(older)).toEqual([86, undefined])
  })
})
