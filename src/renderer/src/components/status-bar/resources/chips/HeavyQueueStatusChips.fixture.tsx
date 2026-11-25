import React from 'react'
import { MemoryStick, Terminal } from 'lucide-react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { HeavyQueueStatusChips, type HeavyQueueChipHost } from './HeavyQueueStatusChips'

const mac = (value: HeavyQueueChipHost['value']): HeavyQueueChipHost => ({
  id: 'local',
  label: 'This computer',
  kind: 'local',
  value
})
const vps = (value: HeavyQueueChipHost['value']): HeavyQueueChipHost => ({
  id: 'env-vps',
  label: 'vps',
  kind: 'server',
  value
})
const ok = (slots: number, running: number, waiting: number) =>
  ({ status: 'ok', counts: { slots, running, waiting } }) as const

function Bar({
  hosts,
  crowded = false
}: {
  hosts: HeavyQueueChipHost[]
  crowded?: boolean
}): React.JSX.Element {
  return (
    <div className="flex h-6 w-full items-center gap-3 overflow-hidden border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
      {crowded ? <span className="shrink-0">main</span> : null}
      <div className="flex shrink-0 items-center gap-1">
        <span className="relative inline-flex items-center gap-1.5 rounded px-1 py-0.5">
          <MemoryStick className="size-3" />
          <Terminal className="size-3" />
          <span className="tabular-nums">1</span>
        </span>
        <HeavyQueueStatusChips hosts={hosts} onOpen={() => {}} />
      </div>
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

export const bothHosts = defineFixture({
  width: 480,
  render: () => <Bar hosts={[mac(ok(2, 2, 0)), vps(ok(2, 1, 4))]} />
})

export const empty = defineFixture({
  width: 480,
  render: () => <Bar hosts={[mac(ok(2, 0, 0)), vps(ok(2, 0, 0))]} />
})

export const onlyVps = defineFixture({
  width: 480,
  render: () => <Bar hosts={[mac({ status: 'none' }), vps(ok(2, 1, 4))]} />
})

export const offline = defineFixture({
  width: 480,
  render: () => <Bar hosts={[mac(ok(2, 2, 0)), vps({ status: 'offline' })]} />
})

export const crowdedNarrow = defineFixture({
  width: 420,
  render: () => <Bar crowded hosts={[mac(ok(2, 2, 0)), vps(ok(2, 1, 4))]} />
})
