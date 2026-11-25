import React, { useState } from 'react'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ProjectRunHostSetting, type RunHostChoiceOption } from './ProjectRunHostSetting'
import { realRunHostOptions, stressRunHostOptions } from './run-host-fixture-options'

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
      <ProjectRunHostSetting
        options={options}
        value={value}
        globalLabel="Automatic"
        onValueChange={setValue}
      />
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

export const wide = defineFixture({ width: 640, render: real('runtime:env-vps') })

export const narrow = defineFixture({ width: 340, render: real('runtime:env-vps') })

export const globalDefaultWide = defineFixture({ width: 640, render: real(null) })

export const globalDefaultNarrow = defineFixture({ width: 340, render: real(null) })

export const openNarrow = defineFixture({
  width: 340,
  render: real(null),
  interact: openDropdown
})

export const stressWide = defineFixture({ width: 640, render: stress })

export const stressNarrow = defineFixture({ width: 340, render: stress })
