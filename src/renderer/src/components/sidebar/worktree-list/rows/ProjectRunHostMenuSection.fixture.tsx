import React, { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import {
  realRunHostOptions,
  stressRunHostOptions
} from '../../../settings/repository/hosts/run-host-fixture-options'
import type { RunHostChoiceOption } from '../../../settings/repository/hosts/ProjectRunHostSetting'
import { ProjectRunHostRadioItems } from './ProjectRunHostMenuSection'

const LOCAL: ExecutionHostId = 'local'

function OpenMenu({
  options,
  initial
}: {
  options: RunHostChoiceOption[]
  initial: ExecutionHostId | null
}): React.JSX.Element {
  const [value, setValue] = useState<ExecutionHostId | null>(initial)
  return (
    <div className="h-96 w-64">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="text-xs">
            Project actions
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={6}>
          <DropdownMenuItem>
            <SlidersHorizontal className="size-3.5" />
            Project Settings
          </DropdownMenuItem>
          <ProjectRunHostRadioItems
            options={options}
            value={value}
            globalLabel="Automatic"
            onValueChange={setValue}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const open = defineFixture({
  width: 260,
  render: () => <OpenMenu options={realRunHostOptions} initial={LOCAL} />
})

export const globalDefault = defineFixture({
  width: 260,
  render: () => <OpenMenu options={realRunHostOptions} initial={null} />
})

export const stressLongList = defineFixture({
  width: 260,
  render: () => <OpenMenu options={stressRunHostOptions} initial="runtime:github.com-client-a" />
})
