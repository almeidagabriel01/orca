import React from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import {
  openRunHostDropdown,
  runHostFixtureStore
} from '../../repository/hosts/run-host-fixture-store'
import { HeavyRunHostDefaultRow } from './heavy-run-host-default-row'

/** The row exactly as Remote Orca Servers mounts it, reading the seeded store. */
const render = (): React.JSX.Element => (
  <div className="p-3">
    <HeavyRunHostDefaultRow allowLocalRuntime />
  </div>
)
const automatic = runHostFixtureStore()
const onVps = runHostFixtureStore({ heavyRunHostDefault: 'runtime:env-vps' })
// A fork.2 user could have clicked an ssh alias here.
const staleAlias = runHostFixtureStore({ heavyRunHostDefault: 'ssh:github.com-client-a' })

export const wide = defineFixture({ width: 640, store: automatic, render })

export const narrow = defineFixture({ width: 340, store: automatic, render })

export const hostWide = defineFixture({ width: 640, store: onVps, render })

export const openWide = defineFixture({
  width: 640,
  store: automatic,
  render,
  interact: openRunHostDropdown
})

export const openNarrow = defineFixture({ ...openWide, width: 340 })

export const staleAliasWide = defineFixture({ width: 640, store: staleAlias, render })

export const staleAliasNarrow = defineFixture({ width: 340, store: staleAlias, render })
