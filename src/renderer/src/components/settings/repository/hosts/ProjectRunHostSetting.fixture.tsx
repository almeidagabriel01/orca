import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ProjectRunHostSetting } from './ProjectRunHostSetting'

const options = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' }
] as never

const render = (): React.JSX.Element => (
  <div className="p-3">
    <ProjectRunHostSetting
      options={options}
      value={'runtime:vps' as never}
      onValueChange={() => {}}
    />
  </div>
)

export const wide = defineFixture({ width: 640, render })

export const narrow = defineFixture({ width: 340, render })
