import React from 'react'
import { Laptop, Server } from 'lucide-react'
import type { Translate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import {
  formatHeavyQueueChip,
  type HeavyQueueChipHost,
  type HeavyQueueChipValue
} from './heavy-queue-chip-state'

export function heavyQueueHostText(value: HeavyQueueChipValue, t: Translate): string {
  return value.status === 'ok'
    ? t(
        'resourceManager.heavyQueueChip.summary',
        '{{running}} of {{slots}} slots running, {{waiting}} waiting',
        {
          running: value.counts.running,
          slots: value.counts.slots,
          waiting: value.counts.waiting
        }
      )
    : t('resourceManager.heavyQueueChip.offline', "Couldn't be reached")
}

/** Icon + numbers per host, rendered inside the Resource Manager trigger. */
export function HeavyQueueTriggerCounts({
  hosts
}: {
  hosts: readonly HeavyQueueChipHost[]
}): React.JSX.Element | null {
  const shown = hosts.filter((host) => host.value.status !== 'none')
  if (shown.length === 0) {
    return null
  }
  return (
    <>
      {shown.map((host) => {
        const Icon = host.kind === 'local' ? Laptop : Server
        const chip = host.value.status === 'ok' ? formatHeavyQueueChip(host.value.counts) : null
        return (
          <span
            key={host.id}
            data-heavy-queue-host={host.id}
            // Why dimmed: an offline host's "–" must not read like a live count.
            className={cn(
              'inline-flex items-center gap-0.5 border-l border-border/60 pl-1.5',
              !chip && 'opacity-50'
            )}
          >
            <Icon aria-hidden="true" className="size-3 text-muted-foreground max-[760px]:hidden" />
            <span className="text-[11px] tabular-nums whitespace-nowrap text-muted-foreground">
              {chip ? chip.fill : '–'}
              {chip?.queued ? (
                <span className="ml-0.5 text-status-warning-text">{chip.queued}</span>
              ) : null}
            </span>
          </span>
        )
      })}
    </>
  )
}
