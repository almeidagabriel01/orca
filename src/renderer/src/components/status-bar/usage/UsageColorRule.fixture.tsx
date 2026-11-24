import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { UsageColorRuleSetting } from '../../settings/appearance/UsageColorRuleSetting'
import { ProviderSegment } from './StatusBarProviderSegment'
import { ProviderPanel } from './provider-usage-panel'

const NOW = Date.now()
const MINUTE = 60_000
const defaults = getDefaultSettings('/home/fixture')

/** A 5h window `elapsed` of the way through, with `usedPercent` spent. */
function reading(usedPercent: number, elapsed: number): ProviderRateLimits {
  return {
    provider: 'claude',
    session: {
      usedPercent,
      windowMinutes: 300,
      resetsAt: NOW + (1 - elapsed) * 300 * MINUTE,
      resetDescription: null
    },
    weekly: null,
    updatedAt: NOW,
    error: null,
    status: 'ok'
  }
}

/** Limits at 70/80: below amber over pace (+15), amber under pace (−18), red over pace (+45). */
const CASES = [reading(55, 0.4), reading(72, 0.9), reading(85, 0.4)]
const settings = { ...defaults, usageColorRule: { watchAt: 70, criticalAt: 80 } }

export const twoSignals = defineFixture({
  store: { settings },
  width: 980,
  render: () => (
    <div className="space-y-3 bg-background p-3 text-xs">
      <div className="flex h-7 items-center gap-6 whitespace-nowrap">
        {CASES.map((p) => (
          <ProviderSegment key={p.session?.usedPercent} p={p} display="used" mode="verbose" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {CASES.map((p) => (
          <div key={p.session?.usedPercent} className="rounded-md border border-border p-3">
            <ProviderPanel p={p} />
          </div>
        ))}
      </div>
    </div>
  )
})

export const setting = defineFixture({
  width: 720,
  render: () => (
    <div className="bg-background p-4">
      <UsageColorRuleSetting settings={settings} updateSettings={() => {}} />
    </div>
  )
})
