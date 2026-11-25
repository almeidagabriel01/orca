import React, { useState } from 'react'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ProjectRunHostSetting, type RunHostChoiceOption } from './ProjectRunHostSetting'

const VPS: ExecutionHostId = 'runtime:vps'

const options: RunHostChoiceOption[] = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' }
]

function Interactive({ initial }: { initial: ExecutionHostId | null }): React.JSX.Element {
  const [value, setValue] = useState(initial)
  return (
    <div className="p-3">
      <ProjectRunHostSetting
        options={options}
        value={value}
        globalLabel="Automatic"
        onValueChange={setValue}
      />
    </div>
  )
}

const render = (): React.JSX.Element => <Interactive initial={VPS} />
const renderGlobal = (): React.JSX.Element => <Interactive initial={null} />

export const wide = defineFixture({ width: 640, render })

export const narrow = defineFixture({ width: 340, render })

export const globalDefaultWide = defineFixture({ width: 640, render: renderGlobal })

export const globalDefaultNarrow = defineFixture({ width: 340, render: renderGlobal })
