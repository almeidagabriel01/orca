import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { UsageColorRule } from '../../../../../shared/agent-usage/pace/usage-pace'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { UsageColorRuleSetting } from '../../settings/appearance/UsageColorRuleSetting'
import { ProviderSegment } from './StatusBarProviderSegment'
import { ProviderPanel } from './provider-usage-panel'

const NOW = Date.now()
const HOUR = 3_600_000
const defaults = getDefaultSettings('/home/fixture')

// 40% of the 5h window has passed: 58% used projects to 145% at reset, far over pace.
function reading(usedPercent: number): ProviderRateLimits {
  return {
    provider: 'claude',
    session: { usedPercent, windowMinutes: 300, resetsAt: NOW + 3 * HOUR, resetDescription: null },
    weekly: null,
    updatedAt: NOW,
    error: null,
    status: 'ok'
  }
}

function Bars(): React.JSX.Element {
  return (
    <div className="space-y-3 bg-background p-3 text-xs">
      <div className="flex h-7 items-center gap-6 whitespace-nowrap">
        {[58, 85, 92].map((used) => (
          <ProviderSegment key={used} p={reading(used)} display="used" mode="verbose" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[58, 85, 92].map((used) => (
          <div key={used} className="rounded-md border border-border p-3">
            <ProviderPanel p={reading(used)} />
          </div>
        ))}
      </div>
    </div>
  )
}

const withRule = (usageColorRule?: UsageColorRule) => ({
  store: { settings: { ...defaults, ...(usageColorRule ? { usageColorRule } : {}) } },
  width: 980,
  render: () => <Bars />
})

/** Default: 58% stays neutral although it runs far over pace; 85% amber, 92% red. */
export const byUsage = defineFixture(withRule())

/** By pace: the same 58% turns red because it would run out before the reset. */
export const byPace = defineFixture(withRule({ mode: 'pace', watchAt: 80, criticalAt: 90 }))

export const setting = defineFixture({
  width: 720,
  render: () => (
    <div className="bg-background p-4">
      <UsageColorRuleSetting settings={defaults} updateSettings={() => {}} />
    </div>
  )
})
