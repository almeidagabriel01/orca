import { useAppStore } from '@/store'
import {
  normalizeUsageColorRule,
  type UsageColorRule
} from '../../../../../shared/agent-usage/pace/usage-pace'

/** The user's usage color rule (Settings > Appearance > Status bar). */
export function useUsageColorRule(): UsageColorRule {
  return normalizeUsageColorRule(useAppStore((s) => s.settings?.usageColorRule))
}
