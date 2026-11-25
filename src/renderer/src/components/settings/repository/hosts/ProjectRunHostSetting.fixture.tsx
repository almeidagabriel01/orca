import React from 'react'
import { useAppStore } from '@/store'
import { getProjectHostSetupProjectionFromState } from '@/store/projects/project-host-setup-selector'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ProjectRunHostRow } from './ProjectRunHostSetting'
import {
  RUN_HOST_FIXTURE_PROJECT_ID,
  openRunHostDropdown,
  runHostFixtureStore
} from './run-host-fixture-store'

/** The row exactly as Project Settings mounts it, reading the seeded store. */
function Row(): React.JSX.Element {
  const setups = useAppStore((state) => getProjectHostSetupProjectionFromState(state).setups)
  return (
    <div className="p-3">
      <ProjectRunHostRow projectId={RUN_HOST_FIXTURE_PROJECT_ID} projectHostSetups={setups} />
    </div>
  )
}

const render = (): React.JSX.Element => <Row />
const onVps = runHostFixtureStore({
  projectRunHostIds: { [RUN_HOST_FIXTURE_PROJECT_ID]: 'runtime:env-vps' }
})
// A fork.2 user could have saved an ssh alias here.
const staleAlias = runHostFixtureStore({
  projectRunHostIds: { [RUN_HOST_FIXTURE_PROJECT_ID]: 'ssh:github.com-client-a' }
})

export const wide = defineFixture({ width: 640, store: onVps, render })

export const narrow = defineFixture({ width: 340, store: onVps, render })

export const openWide = defineFixture({
  width: 640,
  store: runHostFixtureStore(),
  render,
  interact: openRunHostDropdown
})

export const staleAliasWide = defineFixture({ width: 640, store: staleAlias, render })

export const staleAliasNarrow = defineFixture({ width: 340, store: staleAlias, render })
