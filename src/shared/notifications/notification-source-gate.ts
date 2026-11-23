import { isAgentNeedsInputAlert } from './mobile-push-alert'
import type { HostNotificationSettings } from './notification-settings-types'

// Hosts don't report usageLimit: the desktop alone raises usage alerts.
type SourceGateSettings = HostNotificationSettings & { usageLimit?: boolean }

/** The desktop's per-source preferences; paired phones receive an alert only when this allows it. */
export function isNotificationSourceEnabled(
  settings: SourceGateSettings,
  source: string,
  agentState: string | undefined
): boolean {
  if (!settings.enabled) {
    return false
  }
  if (source === 'terminal-bell') {
    return settings.terminalBell
  }
  if (source === 'usage-limit') {
    return settings.usageLimit !== false
  }
  if (source !== 'agent-task-complete') {
    return true
  }
  return isAgentNeedsInputAlert(source, agentState)
    ? settings.agentNeedsInput
    : settings.agentTaskComplete
}
