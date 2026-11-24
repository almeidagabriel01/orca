import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { EmptyWorkspaceSurfaceSection } from './EmptyWorkspaceSurfaceSection'

export const unset = defineFixture({
  width: 760,
  render: () => (
    <div className="bg-background p-4">
      <EmptyWorkspaceSurfaceSection
        settings={getDefaultSettings('/home/fixture')}
        updateSettings={() => {}}
      />
    </div>
  )
})
