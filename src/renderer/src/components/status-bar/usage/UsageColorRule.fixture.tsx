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

const DEFAULT_USED = [58, 85, 92]

function Bars({ used = DEFAULT_USED }: { used?: number[] }): React.JSX.Element {
  return (
    <div className="space-y-3 bg-background p-3 text-xs">
      <div className="flex h-7 items-center gap-6 whitespace-nowrap">
        {used.map((value) => (
          <ProviderSegment key={value} p={reading(value)} display="used" mode="verbose" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {used.map((value) => (
          <div key={value} className="rounded-md border border-border p-3">
            <ProviderPanel p={reading(value)} />
          </div>
        ))}
      </div>
    </div>
  )
}

const withRule = (usageColorRule?: UsageColorRule, used?: number[]) => ({
  store: { settings: { ...defaults, ...(usageColorRule ? { usageColorRule } : {}) } },
  width: 980,
  render: () => <Bars used={used} />
})

/** Default: 58% stays neutral although it runs far over pace; 85% amber, 92% red. */
export const byUsage = defineFixture(withRule())

/** By pace: bars stay neutral; 20% (−20) reads green, 58% and 92% (over pace) read red. */
export const byPace = defineFixture(
  withRule({ mode: 'pace', watchAt: 80, criticalAt: 90 }, [20, 58, 92])
)

export const settingByPace = defineFixture({
  width: 720,
  render: () => (
    <div className="bg-background p-4">
      <UsageColorRuleSetting
        settings={{ ...defaults, usageColorRule: { mode: 'pace', watchAt: 80, criticalAt: 90 } }}
        updateSettings={() => {}}
      />
    </div>
  )
})

export const setting = defineFixture({
  width: 720,
  render: () => (
    <div className="bg-background p-4">
      <UsageColorRuleSetting settings={defaults} updateSettings={() => {}} />
    </div>
  )
})
