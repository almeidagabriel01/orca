import React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  RUN_HOST_FIXTURE_PROJECT_ID,
  RUN_HOST_FIXTURE_REPO,
  runHostFixtureStore
} from '../../../settings/repository/hosts/run-host-fixture-store'
import { ProjectRunHostMenuSection } from './ProjectRunHostMenuSection'

/** The project menu's "Run on" section exactly as mounted, reading the seeded store. */
const render = (): React.JSX.Element => (
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
        <ProjectRunHostMenuSection repo={RUN_HOST_FIXTURE_REPO} />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

export const open = defineFixture({
  width: 280,
  store: runHostFixtureStore({ projectRunHostIds: { [RUN_HOST_FIXTURE_PROJECT_ID]: 'local' } }),
  render
})

export const globalDefault = defineFixture({ width: 280, store: runHostFixtureStore(), render })

export const staleAlias = defineFixture({
  width: 280,
  store: runHostFixtureStore({
    heavyRunHostDefault: 'ssh:github.com-client-a',
    projectRunHostIds: { [RUN_HOST_FIXTURE_PROJECT_ID]: 'ssh:vps' }
  }),
  render
})
