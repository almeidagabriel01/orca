import React, { useState } from 'react'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ProjectRunHostSetting } from './ProjectRunHostSetting'

const options = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' }
] as never

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

const render = (): React.JSX.Element => <Interactive initial={'runtime:vps' as ExecutionHostId} />
const renderGlobal = (): React.JSX.Element => <Interactive initial={null} />

export const wide = defineFixture({ width: 640, render })

export const narrow = defineFixture({ width: 340, render })

export const globalDefaultWide = defineFixture({ width: 640, render: renderGlobal })

export const globalDefaultNarrow = defineFixture({ width: 340, render: renderGlobal })
