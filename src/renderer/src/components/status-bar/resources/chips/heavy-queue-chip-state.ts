import type { HeavyQueueCounts } from '../../../../../../shared/diagnostics/process-stats-types'

export type HeavyQueueChipValue =
  | { status: 'none' }
  | { status: 'offline' }
  | { status: 'ok'; counts: HeavyQueueCounts }

export type HeavyQueueChipOutcome =
  | { kind: 'counts'; counts: HeavyQueueCounts | null }
  | { kind: 'unsupported' }
  | { kind: 'error' }

export type HeavyQueueChipReading = { value: HeavyQueueChipValue; misses: number }

/** Fold one poll outcome into the host's reading; only the 2nd consecutive miss flips to offline. */
export function nextHeavyQueueChipReading(
  prev: HeavyQueueChipReading | undefined,
  outcome: HeavyQueueChipOutcome
): HeavyQueueChipReading {
  if (outcome.kind === 'unsupported' || (outcome.kind === 'counts' && !outcome.counts)) {
    return { value: { status: 'none' }, misses: 0 }
  }
  if (outcome.kind === 'counts' && outcome.counts) {
    return { value: { status: 'ok', counts: outcome.counts }, misses: 0 }
  }
  const misses = (prev?.misses ?? 0) + 1
  if (misses === 1 && prev?.value.status === 'ok') {
    return { value: prev.value, misses }
  }
  return { value: { status: 'offline' }, misses }
}

/** Why: "x/y" reads as slot fill without hover; "+N" is what is queued beyond it. */
export function formatHeavyQueueChip(counts: HeavyQueueCounts): {
  fill: string
  queued: string | null
} {
  return {
    fill: `${counts.running}/${counts.slots}`,
    queued: counts.waiting > 0 ? `+${counts.waiting}` : null
  }
}
