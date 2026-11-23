import { Fragment, useState } from 'react'
import { ChevronDown, Loader2, Replace } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useTranslate } from '@/i18n/use-translate'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import {
  AGENT_CHAT_HOST_ACCOUNT,
  AGENT_CHAT_SYSTEM_ACCOUNT,
  agentSupportsChatAccountChoice
} from '../../../../../../shared/agent-launch/accounts/agent-chat-account-choice'
import type { AgentSessionAgentSwitchTarget } from '../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import {
  claudeChatAccountRows,
  codexHostAccountLabel,
  useHostProviderAccounts
} from './host-claude-chat-accounts'
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type {
  NativeChatAccountControl,
  NativeChatAgentSwitch
} from '../../session/options/structured/use-structured-chat-account'

type SwitchRow = {
  value: string
  agent: string
  /** The menu's line; also how the confirmation names the destination. */
  label: string
  description?: string
  target: AgentSessionAgentSwitchTarget
}

const agentRowValue = (agent: string): string => `agent:${agent}`
const accountRowValue = (choice: string): string => `claude:${choice}`

type AgentSwitchMenuProps = {
  control: NativeChatAccountControl
  agentSwitch: NativeChatAgentSwitch
  variant: 'pill' | 'icon'
}

/** "Continue with": the started chat's agents and Claude accounts; a pick moves the chat in place.
 *  `pill` sits in the composer; `icon` sits on a usage-limit row. */
export function NativeChatAgentSwitchMenu(props: AgentSwitchMenuProps): React.JSX.Element {
  const accounts = useHostProviderAccounts(props.control.target)
  return <NativeChatAgentSwitchMenuView {...props} accounts={accounts} />
}

/** The menu over the host's accounts as loaded; null until they load. */
export function NativeChatAgentSwitchMenuView({
  control,
  agentSwitch,
  variant,
  accounts
}: AgentSwitchMenuProps & { accounts: ProviderAccountsSnapshot | null }): React.JSX.Element {
  const t = useTranslate()
  const [confirming, setConfirming] = useState<SwitchRow | null>(null)
  const [switching, setSwitching] = useState(false)
  const { agent, busy } = agentSwitch
  const claude = accounts && !accounts.failedProviders?.includes('claude') ? accounts.claude : null
  const claudeAccounts = claude ? claudeChatAccountRows(claude) : []
  const selected = claude?.accounts.find((account) => account.id === claude.activeAccountId)
  const claudeHostLabel = selected
    ? (selected.displayName ?? selected.email)
    : t('components.native-chat.account.systemDefault', 'System default')
  const codexAccount = codexHostAccountLabel(accounts)
  const hostAccount = t('components.native-chat.agentSwitch.hostAccount', 'Host account')
  const hostAccountOf = (other: string): string =>
    other === 'codex' && codexAccount ? `${hostAccount} · ${codexAccount}` : hostAccount

  const claudeLabel = (account: string): string => `${structuredAgentLabel('claude')} · ${account}`
  const claudeRows: SwitchRow[] = agentSwitch.agents.includes('claude')
    ? claudeAccounts.length === 0
      ? [
          {
            value: agentRowValue('claude'),
            agent: 'claude',
            label: structuredAgentLabel('claude'),
            target: { agent: 'claude' }
          }
        ]
      : [
          {
            value: accountRowValue(AGENT_CHAT_HOST_ACCOUNT),
            agent: 'claude',
            label: claudeLabel(t('components.native-chat.account.followHost', 'Selected account')),
            description: claudeHostLabel,
            target: { agent: 'claude', accountChoice: AGENT_CHAT_HOST_ACCOUNT }
          },
          {
            value: accountRowValue(AGENT_CHAT_SYSTEM_ACCOUNT),
            agent: 'claude',
            label: claudeLabel(t('components.native-chat.account.systemDefault', 'System default')),
            ...(claude?.systemDefaultEmail ? { description: claude.systemDefaultEmail } : {}),
            target: { agent: 'claude', accountChoice: AGENT_CHAT_SYSTEM_ACCOUNT }
          },
          ...claudeAccounts.map((row) => ({
            ...row,
            label: claudeLabel(row.label),
            value: accountRowValue(row.value),
            agent: 'claude',
            target: { agent: 'claude', accountChoice: row.value }
          }))
        ]
    : []
  const otherAgents = [...new Set([...agentSwitch.agents, agent])].filter(
    (other) => other !== 'claude'
  )
  const agentRows: SwitchRow[] = otherAgents.map((other) => ({
    value: agentRowValue(other),
    agent: other,
    label: structuredAgentLabel(other),
    ...(agentSupportsChatAccountChoice(other) ? {} : { description: hostAccountOf(other) }),
    target: { agent: other }
  }))
  const rows = [...claudeRows, ...agentRows]
  const value =
    agent === 'claude' && claudeAccounts.length > 0
      ? accountRowValue(control.choice ?? AGENT_CHAT_HOST_ACCOUNT)
      : agentRowValue(agent)
  const pinned = claude?.accounts.find((account) => account.id === control.choice)
  const currentLabel =
    agent === 'claude'
      ? !claude
        ? structuredAgentLabel('claude')
        : value === accountRowValue(AGENT_CHAT_HOST_ACCOUNT) || claudeAccounts.length === 0
          ? claudeHostLabel
          : pinned
            ? (pinned.displayName ?? pinned.email)
            : control.choice === AGENT_CHAT_SYSTEM_ACCOUNT
              ? t('components.native-chat.account.systemDefault', 'System default')
              : (control.choice ?? claudeHostLabel)
      : `${structuredAgentLabel(agent)} · ${hostAccountOf(agent)}`
  const noAccountAgents = otherAgents
    .filter((other) => !agentSupportsChatAccountChoice(other))
    .map((other) => structuredAgentLabel(other))
  const title = t('components.native-chat.agentSwitch.title', 'Continue with')
  const actionLabel = t(
    'components.native-chat.agentSwitch.switchNow',
    'Switch account or provider now'
  )

  const run = async (row: SwitchRow, stopRunning: boolean): Promise<void> => {
    setSwitching(true)
    try {
      await agentSwitch.switchTo(row.target, stopRunning)
    } finally {
      setSwitching(false)
    }
  }
  const pick = (row: SwitchRow): void => {
    if (row.value === value || switching) {
      return
    }
    if (busy) {
      setConfirming(row)
      return
    }
    void run(row, false)
  }
  const confirmTarget = confirming
    ? confirming.target.accountChoice === AGENT_CHAT_HOST_ACCOUNT
      ? claudeLabel(claudeHostLabel)
      : confirming.label
    : ''

  const trigger =
    variant === 'pill' ? (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="min-w-0 max-w-48 shrink"
        aria-disabled={switching || undefined}
        aria-busy={switching || undefined}
        aria-label={t(
          'components.native-chat.composer.pillAccessibleName',
          '{{value0}} {{value1}}',
          { value0: title, value1: currentLabel }
        )}
      >
        <AgentIcon agent={isTuiAgent(agent) ? agent : null} size={14} className="shrink-0" />
        <span className="truncate">{currentLabel}</span>
        {switching ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </Button>
    ) : (
      <Button
        type="button"
        variant="chat-tool"
        size="icon-xs"
        aria-disabled={switching || undefined}
        aria-busy={switching || undefined}
        aria-label={actionLabel}
      >
        {switching ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Replace className="size-3.5" />
        )}
      </Button>
    )

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {variant === 'pill' ? title : actionLabel}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" side="top" collisionPadding={8} className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{title}</DropdownMenuLabel>
          {busy ? (
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">
              {t('components.native-chat.agentSwitch.stopFirst', 'Stop the turn to switch')}
            </p>
          ) : null}
          <DropdownMenuRadioGroup aria-label={title} value={value}>
            {rows.map((row, index) => (
              <Fragment key={row.value}>
                {index === claudeRows.length && index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuRadioItem value={row.value} onSelect={() => pick(row)}>
                  <AgentIcon
                    agent={isTuiAgent(row.agent) ? row.agent : null}
                    size={14}
                    className="shrink-0"
                  />
                  <div className="min-w-0 py-0.5">
                    <div className="truncate">{row.label}</div>
                    {row.description ? (
                      <div className="truncate text-xs font-normal text-muted-foreground">
                        {row.description}
                      </div>
                    ) : null}
                  </div>
                </DropdownMenuRadioItem>
              </Fragment>
            ))}
          </DropdownMenuRadioGroup>
          {noAccountAgents.length > 0 ? (
            <p className="border-t border-border px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
              {t(
                'components.native-chat.agentSwitch.hostAccountHint',
                '{{agent}} has no per-chat account; it uses the account selected on the host.',
                { agent: noAccountAgents.join(', ') }
              )}
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {t('components.native-chat.agentSwitch.stopAndSwitch', 'Stop and switch')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'components.native-chat.agentSwitch.stopAndSwitchBody',
                'This stops the current turn and continues the chat on {{target}}.',
                { target: confirmTarget }
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={switching}
              onClick={() => {
                const row = confirming
                setConfirming(null)
                if (row) {
                  void run(row, true)
                }
              }}
            >
              {t('components.native-chat.agentSwitch.stopAndSwitch', 'Stop and switch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
