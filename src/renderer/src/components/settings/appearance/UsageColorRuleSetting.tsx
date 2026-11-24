import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import {
  normalizeUsageColorRule,
  type UsageColorRule
} from '../../../../../shared/agent-usage/pace/usage-pace'
import { NumberField, SettingsRow } from '../form-controls/SettingsFormControls'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { getUsageColorRuleEntry } from './appearance-usage-percentage-search'

/** Amber/red limits for each window's bar and percent; the pace delta keeps its own red/green. */
export function UsageColorRuleSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const t = useTranslate()
  const entry = getUsageColorRuleEntry()
  const rule = normalizeUsageColorRule(settings.usageColorRule)
  const update = (patch: Partial<UsageColorRule>): void =>
    updateSettings({ usageColorRule: { ...rule, ...patch } })
  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description}
      keywords={entry.keywords}
      className="space-y-1"
    >
      <SettingsRow label={entry.title} description={entry.description} control={null} />
      <NumberField
        label={t('components.settings.usageColor.watchAt', 'Amber from')}
        description={t(
          'components.settings.usageColor.watchAtHint',
          'Percent used. Must be below red.'
        )}
        value={rule.watchAt}
        defaultValue={80}
        min={1}
        max={rule.criticalAt - 1}
        integer
        suffix="%"
        onChange={(watchAt) => update({ watchAt })}
      />
      <NumberField
        label={t('components.settings.usageColor.criticalAt', 'Red from')}
        description={t(
          'components.settings.usageColor.criticalAtHint',
          'Percent used. Must be above amber ({{value}}%).',
          { value: String(rule.watchAt) }
        )}
        value={rule.criticalAt}
        defaultValue={90}
        min={rule.watchAt + 1}
        max={100}
        integer
        suffix="%"
        onChange={(criticalAt) => update({ criticalAt })}
      />
    </SearchableSetting>
  )
}
