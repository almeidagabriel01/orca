import { useEffect } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../../store/index'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import {
  USAGE_LIMIT_ALERT_RULES,
  decideUsageLimitAlert,
  parseUsageLimitAlertSlots,
  pruneUsageLimitAlertSlots,
  usageLimitLeftPercent,
  type UsageLimitAlertSlot,
  type UsageLimitAlertWindow
} from '../../../../../shared/agent-usage/alerts/usage-limit-alert'
import { formatUsageLimitResetClock } from '../../../../../shared/agent-session/failures/agent-session-usage-limit'
import { formatAgentTypeLabel } from '../../../../../shared/agent-status/presentation/agent-type-label'
import { isNotificationSourceEnabled } from '../../../../../shared/notifications/notification-source-gate'
import {
  buildUsageRowChips,
  getOwnerUsageAccounts,
  type LocalUsageAccountRosters
} from './status-bar-usage-chips'
import {
  getUsageOwnerHostScope,
  type OwnerUsageRateLimits
} from '../usage/use-owner-usage-rate-limits'

const STORAGE_KEY = 'orca.usageLimitAlerts.v1'
const MAX_READING_AGE_MS = 30 * 60_000
const SAME_WINDOW_TOLERANCE_MS = 10 * 60_000

type UsageLimitCandidate = {
  slotKey: string
  /** `${owner}|${provider}|`: the slots of every account of this provider share it. */
  providerPrefix: string
  accountKey: string
  provider: 'claude' | 'codex'
  window: UsageLimitAlertWindow
  thresholdLeftPercent: number
  usedPercent: number
  resetsAt: number | null
  updatedAt: number
  accountLabel?: string
}

function isAlertProvider(p: ProviderRateLimits | null): p is ProviderRateLimits & {
  provider: 'claude' | 'codex'
} {
  return p?.provider === 'claude' || p?.provider === 'codex'
}

function collectCandidates(
  owner: string,
  ownerUsage: OwnerUsageRateLimits,
  settings: Parameters<typeof getOwnerUsageAccounts>[1],
  localRosters: LocalUsageAccountRosters
): UsageLimitCandidate[] {
  const { claude, codex } = ownerUsage.rateLimits
  // Why every account and not the shown chips: hiding a chip must not silence its alert.
  const chips = buildUsageRowChips({
    providers: [claude, codex].filter(isAlertProvider),
    accounts: 'all',
    accountsByProvider: getOwnerUsageAccounts(ownerUsage, settings, translate, localRosters)
  })
  return chips.flatMap((chip): UsageLimitCandidate[] => {
    const { p } = chip
    if (
      !isAlertProvider(p) ||
      p.status === 'error' ||
      p.status === 'unavailable' ||
      p.error ||
      p.updatedAt <= 0
    ) {
      return []
    }
    const accountKey = chip.accountKey ?? 'provider'
    const providerPrefix = `${owner}|${p.provider}|`
    return (['weekly', 'session'] as const).flatMap((windowKind): UsageLimitCandidate[] => {
      const thresholdLeftPercent = USAGE_LIMIT_ALERT_RULES[windowKind]
      const reading = windowKind === 'weekly' ? p.weekly : p.session
      if (thresholdLeftPercent === null || !reading) {
        return []
      }
      return [
        {
          slotKey: `${providerPrefix}${accountKey}|${windowKind}`,
          providerPrefix,
          accountKey,
          provider: p.provider,
          window: windowKind,
          thresholdLeftPercent,
          usedPercent: reading.usedPercent,
          resetsAt: reading.resetsAt,
          updatedAt: p.updatedAt,
          ...(chip.accountLabel ? { accountLabel: chip.accountLabel } : {})
        }
      ]
    })
  })
}

// Why: an account read before its roster loads is keyed 'provider', later by id; alert once.
function alertedUnderOtherKey(
  slots: Record<string, UsageLimitAlertSlot>,
  candidate: UsageLimitCandidate
): boolean {
  const providerSlot = `${candidate.providerPrefix}provider|${candidate.window}`
  return Object.entries(slots).some(
    ([key, slot]) =>
      key !== candidate.slotKey &&
      key.startsWith(candidate.providerPrefix) &&
      key.endsWith(`|${candidate.window}`) &&
      (candidate.accountKey === 'provider' || key === providerSlot) &&
      slot.fired &&
      slot.resetsAt !== null &&
      candidate.resetsAt !== null &&
      Math.abs(slot.resetsAt - candidate.resetsAt) <= SAME_WINDOW_TOLERANCE_MS
  )
}

function readSlots(): Record<string, UsageLimitAlertSlot> {
  try {
    return parseUsageLimitAlertSlots(localStorage.getItem(STORAGE_KEY))
  } catch {
    return {}
  }
}

function writeSlots(slots: Record<string, UsageLimitAlertSlot>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
  } catch {
    // Storage full or blocked: alerts may repeat, which beats missing one.
  }
}

function announce(candidate: UsageLimitCandidate): void {
  const leftPercent = usageLimitLeftPercent(candidate.usedPercent)
  void window.api.notifications
    .dispatch({
      source: 'usage-limit',
      // Keyed so Claude and Codex crossing together are not collapsed by the burst cooldown.
      attentionKey: `usage-limit:${candidate.slotKey}:${candidate.resetsAt ?? ''}`,
      usageLimitProvider: candidate.provider,
      usageLimitWindow: candidate.window,
      ...(candidate.accountLabel ? { usageLimitAccount: candidate.accountLabel } : {}),
      usageLimitLeftPercent: leftPercent,
      usageLimitResetsAt: candidate.resetsAt
    })
    .catch(() => undefined)
  const resets =
    candidate.resetsAt !== null
      ? translate('components.status-bar.usage.alerts.resets', 'resets {{when}}', {
          when: formatUsageLimitResetClock(candidate.resetsAt)
        })
      : ''
  // Why a toast too: the OS banner is often suppressed while Orca has focus.
  toast.warning(
    translate(
      'components.status-bar.usage.alerts.title',
      '{{provider}} {{window}} limit: {{left}}% left',
      {
        provider: formatAgentTypeLabel(candidate.provider),
        window:
          candidate.window === 'weekly'
            ? translate('components.status-bar.usage.alerts.weekly', 'weekly')
            : translate('components.status-bar.usage.alerts.session', '5h'),
        left: String(leftPercent)
      }
    ),
    { description: [candidate.accountLabel, resets].filter(Boolean).join(' · ') || undefined }
  )
}

/** Warns once per window when a Claude or Codex account of the usage owner runs low. */
export function useUsageLimitAlerts(
  ownerUsage: OwnerUsageRateLimits,
  localRosters: LocalUsageAccountRosters
): void {
  const settings = useAppStore((s) => s.settings)
  const scope = getUsageOwnerHostScope(ownerUsage.remoteOwner)
  const owner = scope ? (scope.kind === 'local' ? 'local' : scope.environmentId) : null
  const candidates = owner ? collectCandidates(owner, ownerUsage, settings, localRosters) : []
  // Why a string: the readings are rebuilt every render, so only a changed value should rerun this.
  const signature = JSON.stringify(candidates)

  useEffect(() => {
    const notifications = useAppStore.getState().settings?.notifications
    const current: UsageLimitCandidate[] = JSON.parse(signature)
    if (!notifications || current.length === 0) {
      return
    }
    const now = Date.now()
    const slots = pruneUsageLimitAlertSlots(readSlots(), now)
    const due: UsageLimitCandidate[] = []
    for (const candidate of current) {
      if (now - candidate.updatedAt > MAX_READING_AGE_MS) {
        continue
      }
      const { fire, next } = decideUsageLimitAlert({
        window: candidate,
        thresholdLeftPercent: candidate.thresholdLeftPercent,
        prior: slots[candidate.slotKey],
        now
      })
      if (fire && !alertedUnderOtherKey(slots, candidate)) {
        due.push(candidate)
      }
      slots[candidate.slotKey] = next
    }
    // Persist before announcing, so another window or a remount can't announce it again.
    writeSlots(slots)
    if (!isNotificationSourceEnabled(notifications, 'usage-limit', undefined)) {
      return
    }
    for (const candidate of due) {
      announce(candidate)
    }
  }, [signature])
}
