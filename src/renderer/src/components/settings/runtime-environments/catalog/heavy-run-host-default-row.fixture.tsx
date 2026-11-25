import React, { useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import type { RunHostChoiceOption } from '../../repository/hosts/ProjectRunHostSetting'
import {
  realRunHostOptions,
  stressRunHostOptions
} from '../../repository/hosts/run-host-fixture-options'
import { HeavyRunHostDefaultSetting } from './heavy-run-host-default-row'

function Interactive({
  options,
  initial
}: {
  options: RunHostChoiceOption[]
  initial: ExecutionHostId | null
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  return (
    <div className="p-3">
      <HeavyRunHostDefaultSetting options={options} value={value} onValueChange={setValue} />
    </div>
  )
}

const openDropdown = (frame: HTMLElement): void => {
  frame.querySelector<HTMLElement>('[role="combobox"]')?.click()
}

const real = (initial: ExecutionHostId | null) => (): React.JSX.Element => (
  <Interactive options={realRunHostOptions} initial={initial} />
)
const stress = (): React.JSX.Element => (
  <Interactive options={stressRunHostOptions} initial="runtime:github.com-client-a" />
)

export const wide = defineFixture({ width: 640, render: real(null) })

export const narrow = defineFixture({ width: 340, render: real(null) })

export const hostWide = defineFixture({ width: 640, render: real('runtime:env-vps') })

export const hostNarrow = defineFixture({ width: 340, render: real('runtime:env-vps') })

export const openWide = defineFixture({
  width: 640,
  render: real(null),
  interact: openDropdown
})

export const stressWide = defineFixture({ width: 640, render: stress })

export const stressNarrow = defineFixture({ width: 340, render: stress })

export const stressOpen = defineFixture({
  width: 340,
  render: stress,
  interact: openDropdown
})
