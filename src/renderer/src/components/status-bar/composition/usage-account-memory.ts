import type { Translate } from '@/i18n/use-translate'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsageRowChip } from './status-bar-usage-chips'

/** An account's last reading with numbers and the host that read it. */
export type AccountReading = { p: ProviderRateLimits; host: string }
/** Last reading per account (provider and email), whichever host read it. */
export type AccountReadingMemory = Map<string, AccountReading>

const STORAGE_KEY = 'orca.usage-account-readings.v1'
const MAX_ACCOUNTS = 32

/** "claude:me@x.com": a login's limits are the account's, the same on every host. */
export function usageAccountIdentity(
  provider: ProviderRateLimits['provider'],
  email: string | null | undefined
): string | undefined {
  const normalized = email?.trim().toLowerCase()
  return normalized ? `${provider}:${normalized}` : undefined
}

function hasUsageWindows(p: ProviderRateLimits): boolean {
  return Boolean(p.session || p.weekly || p.fableWeekly || p.monthly || p.buckets?.length)
}

/** Restored from storage, so a cold start on a host that never ran the account still shows it. */
export function loadAccountReadings(storage: Pick<Storage, 'getItem'>): AccountReadingMemory {
  const memory: AccountReadingMemory = new Map()
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    for (const entry of Array.isArray(saved) ? saved.slice(-MAX_ACCOUNTS) : []) {
      const reading = Array.isArray(entry) ? (entry[1] as Partial<AccountReading>) : null
      if (
        typeof entry[0] === 'string' &&
        typeof reading?.host === 'string' &&
        typeof reading.p?.provider === 'string' &&
        typeof reading.p.updatedAt === 'number'
      ) {
        memory.set(entry[0], reading as AccountReading)
      }
    }
  } catch {
    // Storage may be unavailable or hold garbage; the session memory still works.
  }
  return memory
}

export function saveAccountReadings(
  storage: Pick<Storage, 'setItem'>,
  memory: AccountReadingMemory
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...memory].slice(-MAX_ACCOUNTS)))
  } catch {
    // Quota or unavailable storage: the reading stays remembered for this session.
  }
}

const live = (w: RateLimitWindow | null | undefined, now: number) =>
  w && (w.resetsAt === null || w.resetsAt > now) ? w : null

/** Drops windows that have reset since the reading: their old percent is no longer the usage. */
function withoutResetWindows(p: ProviderRateLimits, now: number): ProviderRateLimits {
  return {
    ...p,
    session: live(p.session, now),
    weekly: live(p.weekly, now),
    fableWeekly: live(p.fableWeekly, now),
    monthly: live(p.monthly, now),
    buckets: p.buckets?.filter((bucket) => live(bucket, now))
  }
}

/**
 * Each chip shows its account's newest reading from any host. A host that has never run the
 * account (Claude's "Updates when Claude runs") or is still fetching shows what another host last
 * read instead, so switching to a workspace on another host never blanks or flickers the chip.
 * A remembered reading loses the windows that reset since, and carries where and when it was read. Calls `save` when a newer reading lands in `memory`.
 */
export function withRememberedAccountReadings(
  chips: readonly UsageRowChip[],
  memory: AccountReadingMemory,
  host: string,
  now: number,
  save?: (memory: AccountReadingMemory) => void
): UsageRowChip[] {
  let changed = false
  const shown = chips.map((chip) => {
    const key = chip.accountIdentity
    if (!key) {
      return chip
    }
    const known = memory.get(key)
    if (hasUsageWindows(chip.p) && (!known || chip.p.updatedAt >= known.p.updatedAt)) {
      if (!known || chip.p.updatedAt > known.p.updatedAt || known.host !== host) {
        memory.set(key, { p: chip.p, host })
        changed = true
      }
      return chip
    }
    if (!known) {
      return chip
    }
    const p = withoutResetWindows(known.p, now)
    if (!hasUsageWindows(p)) {
      return chip
    }
    return { ...chip, p, readOn: { host: known.host, at: p.updatedAt } }
  })
  if (changed) {
    save?.(memory)
  }
  return shown
}

let appMemory: AccountReadingMemory | undefined
const saveToLocalStorage = (memory: AccountReadingMemory) =>
  saveAccountReadings(localStorage, memory)

function appAccountReadings(): AccountReadingMemory {
  appMemory ??= loadAccountReadings(localStorage)
  return appMemory
}

/** The chips with remembered readings, kept in localStorage across hosts and restarts. */
export function rememberAccountReadings(
  chips: readonly UsageRowChip[],
  remoteHost: string | undefined,
  t: Translate
): UsageRowChip[] {
  const host = remoteHost ?? t('components.status-bar.usage.accounts.thisDevice', 'this device')
  return withRememberedAccountReadings(
    chips,
    appAccountReadings(),
    host,
    Date.now(),
    saveToLocalStorage
  )
}
