import { Fragment, useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, Loader2 } from 'lucide-react'
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { useAppStore } from '@/store'
import { useAccountOwnerUsage } from '@/components/status-bar/usage/use-owner-usage-rate-limits'
import { useNativeChatOrcaStopView } from '../../messages/notices/native-chat-orca-stop-context'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import { normalizeUsagePercentageDisplay } from '../../../../../../shared/agent-usage/display/usage-percentage-display'
import { formatUsageLimitResetClock } from '../../../../../../shared/agent-session/failures/agent-session-usage-limit'
import type { RateLimitState } from '../../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { AccountOwner } from '@/runtime/provider-accounts/ownership/wsl-host-account-owner'
import type { ProviderAccountsSnapshot } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import { useAgentCliPresence } from '@/components/settings/accounts/provider-not-installed'
import { useHostProviderAccounts } from './host-claude-chat-accounts'
import { agentSwitchMenuModel, type SwitchRow } from './native-chat-agent-switch-rows'
import type {
  NativeChatAccountControl,
  NativeChatAgentSwitch
} from '../../session/options/structured/use-structured-chat-account'

type AgentSwitchMenuProps = {
  control: NativeChatAccountControl
  agentSwitch: NativeChatAgentSwitch
  /** `pill` sits in the composer, `icon` in a tool row, `button` is a labeled action on a card. */
  variant: 'pill' | 'icon' | 'button'
  /** `button` only: the card's main action, filled. */
  prominent?: boolean
}

/** "Continue with": the started chat's agents and Claude accounts; a pick moves the chat in place. */
export function NativeChatAgentSwitchMenu(props: AgentSwitchMenuProps): React.JSX.Element {
  const target = props.control.target
  const hostAccounts = useHostProviderAccounts(target)
  const owner = useMemo<AccountOwner>(() => ({ target, wslHostDistro: null }), [target])
  const ownerUsage = useAccountOwnerUsage(
    owner,
    useAppStore((state) => state.rateLimits)
  )
  const fetchInactiveClaudeUsage = useAppStore((state) => state.fetchInactiveClaudeAccountUsage)
  // Set only where a usage-limit row provides it; the composer has no schedule to name.
  const stop = useNativeChatOrcaStopView()
  const auto = stop.usageLimitTurnItemId === null ? null : stop.usageLimitAutoContinue
  const presence = useAgentCliPresence(target)
  return (
    <NativeChatAgentSwitchMenuView
      {...props}
      installed={(agent) => (isTuiAgent(agent) ? presence.installed(agent) : null)}
      accounts={ownerUsage.accounts ?? hostAccounts}
      usage={ownerUsage.rateLimits}
      autoContinueAt={auto?.kind === 'scheduled' ? auto.resetsAt : null}
      // A remote host streams its readings; this device reads its other accounts on demand.
      onOpen={target.kind === 'local' ? () => void fetchInactiveClaudeUsage() : undefined}
    />
  )
}

/** The menu over the host's accounts and readings as loaded; each is null until it loads. */
export function NativeChatAgentSwitchMenuView({
  control,
  agentSwitch,
  variant,
  prominent = false,
  accounts,
  usage,
  autoContinueAt,
  onOpen,
  installed
}: AgentSwitchMenuProps & {
  accounts: ProviderAccountsSnapshot | null
  usage: RateLimitState | null
  /** When Orca continues this usage-limited chat by itself; a switch cancels it. */
  autoContinueAt: number | null
  onOpen?: () => void
  /** The host's CLI inventory; agents it lacks stay behind "Show all providers". */
  installed?: (agent: string) => boolean | null
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const display = normalizeUsagePercentageDisplay(
    useAppStore((state) => state.usagePercentageDisplay)
  )
  const [confirming, setConfirming] = useState<SwitchRow | null>(null)
  const [switching, setSwitching] = useState(false)
  // Read when the menu opens, so readings whose window has since reset stop counting.
  const [now, setNow] = useState(Date.now)
  const [showAll, setShowAll] = useState(false)
  const { agent, busy } = agentSwitch
  const { rows, hiddenCount, value, currentLabel } = agentSwitchMenuModel({
    agent,
    agents: agentSwitch.agents,
    choice: control.choice,
    accounts,
    usage,
    display,
    now,
    locale,
    t,
    installed,
    showAll
  })
  const title = t('components.native-chat.agentSwitch.title', 'Continue with')
  const actionLabel = t(
    'components.native-chat.agentSwitch.switchButton',
    'Switch account or agent'
  )

  const run = (row: SwitchRow, stopRunning: boolean): Promise<void> => {
    setSwitching(true)
    return agentSwitch.switchTo(row.target, stopRunning).finally(() => setSwitching(false))
  }
  const pick = (row: SwitchRow): void => {
    if (row.value === value || row.disabled || switching) {
      return
    }
    if (busy) {
      setConfirming(row)
      return
    }
    void run(row, false)
  }

  const spinner = switching ? <Loader2 className="size-3.5 animate-spin" /> : null
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
    ) : variant === 'button' ? (
      <Button
        type="button"
        variant={prominent ? 'default' : 'outline'}
        size="xs"
        // A label that doesn't fit a narrow card wraps rather than truncating.
        className="h-auto min-h-6 whitespace-normal text-left"
        aria-disabled={switching || undefined}
        aria-busy={switching || undefined}
      >
        {switching ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
        {actionLabel}
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
        {spinner ?? <ArrowLeftRight className="size-3.5" />}
      </Button>
    )

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            setNow(Date.now())
            setShowAll(false)
            onOpen?.()
          }
        }}
      >
        {variant === 'button' ? (
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {variant === 'pill' ? title : actionLabel}
            </TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuContent align="start" side="top" collisionPadding={8} className="w-80">
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          {busy ? (
            <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">
              {t('components.native-chat.agentSwitch.stopFirst', 'Stop the turn to switch')}
            </p>
          ) : null}
          <DropdownMenuRadioGroup aria-label={title} value={value}>
            {rows.map((row, index) => {
              const previous = rows[index - 1]
              const newAgent = previous?.agent !== row.agent
              return (
                <Fragment key={row.value}>
                  {previous && (newAgent || previous.group !== row.group) ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  {newAgent ? (
                    <DropdownMenuLabel>
                      <span className="flex items-center gap-2">
                        <AgentIcon agent={isTuiAgent(row.agent) ? row.agent : null} size={14} />
                        {structuredAgentLabel(row.agent)}
                      </span>
                    </DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuRadioItem
                    value={row.value}
                    disabled={row.disabled}
                    onSelect={() => pick(row)}
                  >
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate">{row.label}</span>
                        {row.usage && !row.description ? (
                          <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                            {row.usage.text}
                          </span>
                        ) : null}
                      </span>
                      {row.description ? (
                        <span className="flex items-start gap-3 text-xs font-normal text-muted-foreground">
                          <span
                            className={cn(
                              'min-w-0 flex-1',
                              row.group === 'rule' ? 'line-clamp-2' : 'truncate'
                            )}
                          >
                            {row.description}
                          </span>
                          {row.usage ? (
                            <span className="shrink-0 tabular-nums">{row.usage.text}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuRadioItem>
                </Fragment>
              )
            })}
          </DropdownMenuRadioGroup>
          {hiddenCount > 0 ? (
            <DropdownMenuItem
              onSelect={(event) => {
                // Why: keep the menu open so the added providers show in place.
                event.preventDefault()
                setShowAll(true)
              }}
            >
              <span className="text-xs text-muted-foreground">
                {t('components.native-chat.agentSwitch.showAll', 'Show all providers')}
              </span>
            </DropdownMenuItem>
          ) : null}
          {autoContinueAt !== null ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2.5 pt-0.5 pb-1 text-xs text-muted-foreground">
                {t(
                  'components.native-chat.agentSwitch.cancelsAutoContinue',
                  'Switching cancels the automatic continue at {{time}}.',
                  // The clock wraps as one piece, so "10:43" and "PM" never split.
                  {
                    time: formatUsageLimitResetClock(autoContinueAt, now, locale).replace(
                      /\s/g,
                      '\u00a0'
                    )
                  }
                )}
              </p>
            </>
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
                { target: confirming?.destination ?? '' }
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
