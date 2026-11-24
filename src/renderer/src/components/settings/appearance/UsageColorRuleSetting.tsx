import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import {
  normalizeUsageColorRule,
  type UsageColorRule
} from '../../../../../shared/agent-usage/pace/usage-pace'
import {
  NumberField,
  SettingsRow,
  SettingsSegmentedControl
} from '../form-controls/SettingsFormControls'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { getUsageColorRuleEntry } from './appearance-usage-percentage-search'

/** Usage bar color: by used share (amber/red thresholds) or by pace. */
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
      <SettingsRow
        label={entry.title}
        description={
          rule.mode === 'used'
            ? t(
                'components.settings.usageColor.usedHint',
                'Color only means the real limit; the pace mark and delta stay neutral.'
              )
            : t(
                'components.settings.usageColor.paceHint',
                'The bar stays neutral; the pace delta turns red over pace and green under it.'
              )
        }
        control={
          <SettingsSegmentedControl
            ariaLabel={entry.title}
            value={rule.mode}
            onChange={(mode) => update({ mode })}
            options={[
              {
                value: 'used',
                label: t('components.settings.usageColor.byUse', 'By actual usage')
              },
              { value: 'pace', label: t('components.settings.usageColor.byPace', 'By pace') }
            ]}
          />
        }
      />
      {/* Thresholds color only by used share. */}
      {rule.mode === 'used' ? (
        <>
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
        </>
      ) : null}
    </SearchableSetting>
  )
}
