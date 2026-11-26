import React from 'react'
import { Popover } from '@/components/ui/popover'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { renderResourceUsageStatusTrigger } from '../popover/resource-usage-status-trigger'
import type { HeavyQueueChipHost } from './heavy-queue-chip-state'

const ok = (slots: number, running: number, waiting: number): HeavyQueueChipHost['value'] => ({
  status: 'ok',
  counts: { slots, running, waiting }
})
const hosts = (vps: HeavyQueueChipHost['value']): HeavyQueueChipHost[] => [
  { id: 'local', label: 'This computer', kind: 'local', value: ok(2, 0, 0) },
  { id: 'env-vps', label: 'vps', kind: 'server', value: vps }
]

function Bar({
  value,
  crowded = false
}: {
  value: HeavyQueueChipHost['value']
  crowded?: boolean
}): React.JSX.Element {
  return (
    <div className="flex h-6 w-full items-center gap-3 overflow-hidden border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
      {crowded ? <span className="shrink-0">main</span> : null}
      <Popover>
        {renderResourceUsageStatusTrigger({
          daemonUnreachable: false,
          resourceManagerAriaLabel: 'Resource Manager',
          spaceScanReady: false,
          commitToneClass: null,
          triggerSessionCount: 1,
          orphanCount: 0,
          resourceManagerTooltipLines: [],
          heavyQueueHosts: hosts(value)
        })}
      </Popover>
      {crowded ? (
        <>
          <span className="shrink-0 whitespace-nowrap">Ports 3</span>
          <span className="shrink-0 whitespace-nowrap">SSH 2 hosts</span>
          <span className="shrink-0 whitespace-nowrap">Update available</span>
          <span className="shrink-0 whitespace-nowrap">Claude 42%</span>
        </>
      ) : null}
    </div>
  )
}

export const queueWide = defineFixture({
  width: 480,
  render: () => <Bar value={ok(2, 2, 5)} />
})

export const queueNarrow = defineFixture({
  width: 420,
  render: () => <Bar crowded value={ok(2, 2, 5)} />
})

export const queueVpsOffline = defineFixture({
  width: 480,
  render: () => <Bar value={{ status: 'offline' }} />
})
