import { describe, expect, it } from 'vitest'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { buildUsageRowChips, type UsageAccountEntry } from './status-bar-usage-chips'
import {
  type AccountReadingMemory,
  loadAccountReadings,
  saveAccountReadings,
  withRememberedAccountReadings
} from './usage-account-memory'

const NOW = 10_000_000

const week = (usedPercent: number) => ({
  usedPercent,
  windowMinutes: 10_080,
  resetsAt: 9_000_000_000,
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
}

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

const remember = (
  chips: ReturnType<typeof hostChips>,
  memory: AccountReadingMemory,
  host = 'vps'
) => withRememberedAccountReadings(chips, memory, host, NOW)

const weekly = (chips: ReturnType<typeof hostChips>) =>
  chips.map((chip) => chip.p.weekly?.usedPercent)

describe('usage readings follow the account across hosts', () => {
  it('keeps the account reading when the workspace moves to a host that never ran it', () => {
    const memory: AccountReadingMemory = new Map()
    const vps = remember(hostChips(reading(84, 100), reading(32, 100)), memory)
    expect(weekly(vps)).toEqual([84, 32])
    const mac = remember(hostChips(neverRan, reading(32, 100)), memory, 'this device')
    expect(weekly(mac)).toEqual([84, 32])
    expect(mac[0]!.p.status).toBe('ok')
  })

  it('takes the newest reading any host brings, and leaves an account no host has read alone', () => {
    const memory: AccountReadingMemory = new Map()
    remember(hostChips(reading(84, 100), neverRan), memory)
    const later = remember(hostChips(reading(86, 200), neverRan), memory)
    expect(weekly(later)).toEqual([86, undefined])
    expect(later[1]!.p.status).toBe('error')
    // An older reading from a host that read the account earlier never wins over the newer one.
    const older = remember(hostChips(reading(80, 150), neverRan), memory)
    expect(weekly(older)).toEqual([86, undefined])
  })

  it('restores readings saved by an earlier run, so a cold start on the Mac still shows them', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value)
    }
    const save = (memory: AccountReadingMemory) => saveAccountReadings(storage, memory)
    withRememberedAccountReadings(
      hostChips(reading(84, NOW), neverRan),
      new Map(),
      'vps',
      NOW,
      save
    )
    const restarted = loadAccountReadings(storage)
    const mac = withRememberedAccountReadings(hostChips(neverRan, neverRan), restarted, 'Mac', NOW)
    expect(weekly(mac)).toEqual([84, undefined])
    expect(loadAccountReadings({ getItem: () => '{broken' }).size).toBe(0)
  })

  it('drops windows that reset since the reading and says when and where it was read', () => {
    const memory: AccountReadingMemory = new Map()
    const old = reading(84, 100)
    old.session = { ...old.session!, usedPercent: 97, resetsAt: NOW - 1 }
    remember(hostChips(old, neverRan), memory)
    const [mac] = remember(hostChips(neverRan, neverRan), memory, 'Mac')
    expect(mac!.p.session).toBeNull()
    expect(mac!.p.weekly?.usedPercent).toBe(84)
    expect(mac!.readOn).toEqual({ host: 'vps', at: 100 })
    // The host's own newer reading wins with no note; a reading whose every window reset shows nothing old.
    expect(
      remember(hostChips(reading(85, NOW), neverRan), memory, 'Mac')[0]!.readOn
    ).toBeUndefined()
    const allReset = { ...old, weekly: { ...old.weekly!, resetsAt: NOW } }
    const reset: AccountReadingMemory = new Map([
      ['claude:gabriel@example.com', { p: allReset, host: 'vps' }]
    ])
    expect(remember(hostChips(neverRan, neverRan), reset, 'Mac')[0]!.p.status).toBe('error')
  })
})
