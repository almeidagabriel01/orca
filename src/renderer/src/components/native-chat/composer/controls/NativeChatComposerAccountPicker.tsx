import { ChevronDown, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { getAccountDisplayName } from '../../../../../../shared/agent-accounts/managed-account-display-names'
import { AccountDefaultBadge } from '@/components/status-bar/accounts/AccountSwitchRowItem'
import {
  claudeChatAccountRows,
  claudeChoiceRows,
  useHostClaudeAccounts
} from './host-claude-chat-accounts'
import type { NativeChatAccountControl } from '../../session/options/structured/use-structured-chat-account'
import { NativeChatAgentSwitchMenu } from './NativeChatAgentSwitchMenu'

/** The chat's account before it starts; once started, where it continues ("Continue with"). */
export function NativeChatComposerAccountPicker({
  control
}: {
  control: NativeChatAccountControl
}): React.JSX.Element | null {
  return control.agentSwitch ? (
    <NativeChatAgentSwitchMenu control={control} agentSwitch={control.agentSwitch} variant="pill" />
  ) : (
    <NativeChatComposerAccountOnlyPicker control={control} />
  )
}

/** Picks which of the host's accounts this chat runs on, apart from the host-wide selection. */
function NativeChatComposerAccountOnlyPicker({
  control
}: {
  control: NativeChatAccountControl
}): React.JSX.Element | null {
  const t = useTranslate()
  const state = useHostClaudeAccounts(control.target)
  // With no saved account every chat already runs on the host's own login.
  if (!state || claudeChatAccountRows(state).length === 0) {
    return null
  }
  const { rows, value } = claudeChoiceRows(
    state,
    control.choice,
    t('accounts.ownLogin', "This computer's login")
  )
  const pinned = state.accounts.find((account) => account.id === value)
  const triggerLabel =
    rows.find((row) => row.value === value)?.label ??
    (pinned ? (getAccountDisplayName(pinned) ?? pinned.email) : value)
  const disabled = control.choose === undefined
  const title = t('components.native-chat.account.title', 'Account')
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="min-w-0 max-w-40 shrink"
              aria-label={t(
                'components.native-chat.composer.pillAccessibleName',
                '{{value0}} {{value1}}',
                {
                  value0: title,
                  value1: triggerLabel
                }
              )}
            >
              <UserRound className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {disabled
            ? t(
                'components.native-chat.account.locked',
                'This chat keeps the account it started on.'
              )
            : t(
                'components.native-chat.account.hint',
                'The account this chat runs on. Other chats use the default.'
              )}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="top" collisionPadding={8} className="w-72">
        <DropdownMenuRadioGroup aria-label={title} value={value}>
          {rows.map((row) => (
            <DropdownMenuRadioItem
              key={row.value}
              value={row.value}
              // Picking the shown row keeps the chat's choice, so following the host stays put.
              onSelect={() => row.value !== value && control.choose?.(row.value)}
            >
              <div className="min-w-0 py-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{row.label}</span>
                  {row.isDefault ? <AccountDefaultBadge /> : null}
                </div>
                {row.description ? (
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {row.description}
                  </div>
                ) : null}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
