import React, { useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { RunHostChoiceOption } from '../../repository/hosts/ProjectRunHostSetting'
import { HeavyRunHostDefaultSetting } from './heavy-run-host-default-row'

const VPS: ExecutionHostId = 'runtime:vps'

const options: RunHostChoiceOption[] = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' },
  { hostId: 'ssh:build-box', label: 'build-box', disabled: true }
]

function Interactive({ initial }: { initial: ExecutionHostId | null }): React.JSX.Element {
  const [value, setValue] = useState(initial)
  return (
    <div className="p-3">
      <HeavyRunHostDefaultSetting options={options} value={value} onValueChange={setValue} />
    </div>
  )
}

const renderAutomatic = (): React.JSX.Element => <Interactive initial={null} />
const renderHost = (): React.JSX.Element => <Interactive initial={VPS} />

export const wide = defineFixture({ width: 640, render: renderAutomatic })

export const narrow = defineFixture({ width: 340, render: renderAutomatic })

export const hostWide = defineFixture({ width: 640, render: renderHost })

export const hostNarrow = defineFixture({ width: 340, render: renderHost })
