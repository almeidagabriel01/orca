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
import { ProjectRunHostRadioItems } from './ProjectRunHostMenuSection'

const options = [
  { hostId: 'local', label: 'Mac' },
  { hostId: 'runtime:vps', label: 'vps' }
] as never

function OpenMenu(): React.JSX.Element {
  const [value, setValue] = useState<ExecutionHostId | null>('local' as ExecutionHostId)
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
          <ProjectRunHostRadioItems options={options} value={value} onValueChange={setValue} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const open = defineFixture({ width: 260, render: () => <OpenMenu /> })
