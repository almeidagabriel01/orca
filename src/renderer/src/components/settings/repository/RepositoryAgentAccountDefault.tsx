import {
  AGENT_CHAT_SYSTEM_ACCOUNT,
  agentSupportsChatAccountChoice
} from '../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import { AGENT_SESSION_CHAT_ACCOUNT_RUNTIME_CAPABILITY } from '../../../../../shared/agent-session/lifecycle/operations/agent-session-create-capabilities'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import {
  claudeChatAccountRows,
  useHostClaudeAccounts
} from '../../native-chat/composer/controls/host-claude-chat-accounts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SettingsRow } from '../form-controls/SettingsFormControls'
import { useTranslate } from '@/i18n/use-translate'

const INHERIT = 'inherit'

/** The saved account new chats of `agent` in this project start on; the composer still picks per chat. */
export function RepositoryAgentAccountDefault(props: {
  agent: string
  target: RuntimeClientTarget
  value: string | undefined
  disabled: boolean
  inheritLabel: string
  onChange: (choice: string | undefined) => void
}): React.JSX.Element | null {
  const capability = useStructuredAgentSessionHostCapabilityState(
    props.target,
    AGENT_SESSION_CHAT_ACCOUNT_RUNTIME_CAPABILITY
  )
  return agentSupportsChatAccountChoice(props.agent) && capability === 'supported' ? (
    <AccountSelect {...props} />
  ) : null
}

function AccountSelect({
  target,
  value,
  disabled,
  inheritLabel,
  onChange
}: Parameters<typeof RepositoryAgentAccountDefault>[0]): React.JSX.Element | null {
  const t = useTranslate()
  const state = useHostClaudeAccounts(target)
  const accounts = state ? claudeChatAccountRows(state) : []
  // With no saved account every chat already runs on System default.
  if (!state || accounts.length === 0) {
    return null
  }
  const label = t('settings.projectAgentDefaults.account', 'Account')
  const rows = [
    {
      value: AGENT_CHAT_SYSTEM_ACCOUNT,
      label: t('components.native-chat.account.systemDefault', 'System default')
    },
    ...accounts
  ]
  // A saved choice whose account is gone stays visible, so it can be cleared.
  if (value && !rows.some((row) => row.value === value)) {
    rows.push({ value, label: value })
  }
  return (
    <SettingsRow
      label={label}
      description={t(
        'settings.projectAgentDefaults.accountDescription',
        'The account new chats in this project start on. Changing it in a chat changes only that chat.'
      )}
      control={
        <Select
          value={value ?? INHERIT}
          disabled={disabled}
          onValueChange={(next) => onChange(next === INHERIT ? undefined : next)}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>
            {rows.map((row) => (
              <SelectItem key={row.value} value={row.value}>
                {row.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}
