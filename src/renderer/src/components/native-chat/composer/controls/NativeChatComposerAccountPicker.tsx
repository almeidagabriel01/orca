import { useEffect, useState } from 'react'
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
import { fetchProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { ClaudeRateLimitAccountsState } from '../../../../../../shared/agent-accounts/managed-account-types'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  AGENT_CHAT_SYSTEM_ACCOUNT
} from '../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { NativeChatAccountControl } from '../../session/options/structured/use-structured-chat-account'

type AccountRow = { value: string; label: string; description?: string }

/** The chat host's own Claude accounts; WSL accounts never run a native chat. */
function accountRows(state: ClaudeRateLimitAccountsState): AccountRow[] {
  return state.accounts
    .filter((account) => account.managedAuthRuntime !== 'wsl' && !account.needsSignIn)
    .map((account) => ({
      value: account.id,
      label: account.displayName ?? account.email,
      ...(account.organizationName ? { description: account.organizationName } : {})
    }))
}

/** Picks which of the host's accounts this chat runs on, apart from the host-wide selection. */
export function NativeChatComposerAccountPicker({
  control
}: {
  control: NativeChatAccountControl
}): React.JSX.Element | null {
  const t = useTranslate()
  const [state, setState] = useState<ClaudeRateLimitAccountsState | null>(null)
  const { target } = control
  useEffect(() => {
    let current = true
    fetchProviderAccountsSnapshot(target)
      .then((snapshot) => {
        if (current && !snapshot.failedProviders?.includes('claude')) {
          setState(snapshot.claude)
        }
      })
      .catch((error: unknown) => console.warn('[native-chat] Claude accounts unavailable', error))
    return () => {
      current = false
    }
  }, [target])
  const accounts = state ? accountRows(state) : []
  // With no saved account every chat already runs on System default.
  if (!state || accounts.length === 0) {
    return null
  }
  const selected = state.accounts.find((account) => account.id === state.activeAccountId)
  const hostLabel = selected
    ? (selected.displayName ?? selected.email)
    : t('components.native-chat.account.systemDefault', 'System default')
  const rows: AccountRow[] = [
    {
      value: AGENT_CHAT_HOST_ACCOUNT,
      label: t('components.native-chat.account.followHost', 'Selected account'),
      description: hostLabel
    },
    {
      value: AGENT_CHAT_SYSTEM_ACCOUNT,
      label: t('components.native-chat.account.systemDefault', 'System default'),
      ...(state.systemDefaultEmail ? { description: state.systemDefaultEmail } : {})
    },
    ...accounts
  ]
  const value = control.choice ?? AGENT_CHAT_HOST_ACCOUNT
  const shown = rows.find((row) => row.value === value)
  const pinned = state.accounts.find((account) => account.id === value)
  const triggerLabel =
    value === AGENT_CHAT_HOST_ACCOUNT
      ? hostLabel
      : (shown?.label ?? (pinned ? (pinned.displayName ?? pinned.email) : value))
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
                'The account this chat runs on. Other chats keep the selected account.'
              )}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="top" collisionPadding={8} className="w-72">
        <DropdownMenuRadioGroup aria-label={title} value={value}>
          {rows.map((row) => (
            <DropdownMenuRadioItem
              key={row.value}
              value={row.value}
              onSelect={() => control.choose?.(row.value)}
            >
              <div className="min-w-0 py-0.5">
                <div className="truncate">{row.label}</div>
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
