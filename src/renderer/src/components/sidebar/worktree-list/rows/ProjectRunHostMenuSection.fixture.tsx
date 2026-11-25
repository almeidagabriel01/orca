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
import type { ProjectRunHostOption } from '@/lib/workspace/creation/project-run-host'
import { ProjectRunHostRadioItems } from './ProjectRunHostMenuSection'

const LOCAL: ExecutionHostId = 'local'

const options: ProjectRunHostOption[] = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' }
]

function OpenMenu({ initial }: { initial: ExecutionHostId | null }): React.JSX.Element {
  const [value, setValue] = useState<ExecutionHostId | null>(initial)
  return (
    <div className="h-48 w-64">
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
            globalLabel="vps"
            onValueChange={setValue}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const open = defineFixture({
  width: 260,
  render: () => <OpenMenu initial={LOCAL} />
})

export const globalDefault = defineFixture({
  width: 260,
  render: () => <OpenMenu initial={null} />
})
