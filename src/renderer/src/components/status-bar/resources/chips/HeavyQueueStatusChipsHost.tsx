import React from 'react'
import { HeavyQueueStatusChips } from './HeavyQueueStatusChips'
import { useHeavyQueueChips } from './use-heavy-queue-chips'

export function HeavyQueueStatusChipsHost({ onOpen }: { onOpen: () => void }): React.JSX.Element {
  return <HeavyQueueStatusChips hosts={useHeavyQueueChips()} onOpen={onOpen} />
}
