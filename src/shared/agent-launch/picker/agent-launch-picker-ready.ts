import type { AgentPickerEntry } from './agent-launch-picker'
import { agentMenuRowReady } from './agent-launch-picker-rows'

/** Whether the host can run this agent now, not only offer to install it ('Install required', 'Not installed'). */
export function agentPickerEntryReady(entry: Pick<AgentPickerEntry, 'rows'>): boolean {
  return entry.rows.some(agentMenuRowReady)
}

/** With no search, agents the host can't run yet wait behind "Show all agents". */
export function collapseUnreadyAgentPickerEntries<Entry extends Pick<AgentPickerEntry, 'rows'>>(
  entries: readonly Entry[],
  query: string,
  showAll: boolean
): { shown: Entry[]; hiddenCount: number } {
  if (showAll || query.trim() !== '') {
    return { shown: [...entries], hiddenCount: 0 }
  }
  const shown = entries.filter(agentPickerEntryReady)
  return { shown, hiddenCount: entries.length - shown.length }
}
