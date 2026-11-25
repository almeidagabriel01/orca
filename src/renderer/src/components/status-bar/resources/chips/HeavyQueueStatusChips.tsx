import React from 'react'
import { Laptop, Server } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../../composition/status-bar-context-menu-policy'
import { formatHeavyQueueChip, type HeavyQueueChipValue } from './heavy-queue-chip-state'

export type HeavyQueueChipHost = {
  id: string
  label: string
  kind: 'local' | 'server'
  value: HeavyQueueChipValue
}

export function HeavyQueueStatusChips({
  hosts,
  onOpen
}: {
  hosts: readonly HeavyQueueChipHost[]
  onOpen: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const shown = hosts.filter((host) => host.value.status !== 'none')
  if (shown.length === 0) {
    return null
  }
  return (
    <>
      {shown.map((host) => {
        const Icon = host.kind === 'local' ? Laptop : Server
        const { value } = host
        const chip = value.status === 'ok' ? formatHeavyQueueChip(value.counts) : null
        const text =
          value.status === 'ok'
            ? t(
                'resourceManager.heavyQueueChip.summary',
                '{{running}} of {{slots}} slots running, {{waiting}} waiting',
                {
                  running: value.counts.running,
                  slots: value.counts.slots,
                  waiting: value.counts.waiting
                }
              )
            : t('resourceManager.heavyQueueChip.offline', "Couldn't be reached")
        return (
          <Tooltip key={host.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
                onClick={onOpen}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/70"
                aria-label={t('resourceManager.heavyQueueChip.aria', '{{host}}: {{text}}', {
                  host: host.label,
                  text
                })}
              >
                <Icon className="size-3 text-muted-foreground" />
                <span className="text-[11px] tabular-nums whitespace-nowrap text-muted-foreground">
                  {chip ? chip.fill : '–'}
                  {chip?.queued ? (
                    <span className="ml-0.5 text-status-warning-text">{chip.queued}</span>
                  ) : null}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {host.label} · {text}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </>
  )
}
