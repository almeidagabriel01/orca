// The composer footer's host: a menu of the hand-off Environments; another one opens the hand-off there.
import { ChevronDown, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useHandoffDestinations } from '@/components/agent-session-continuation/use-handoff-destinations'
import {
  handoffBlockText,
  handoffRowDetail
} from '@/components/agent-session-continuation/HandoffEnvironmentField'
import { isPickableHandoffDestination } from '@/lib/agent-session/launch/continuation/handoff-destinations'
import type { NativeChatHandOffTarget } from '../../pane/actions/use-native-chat-hand-off'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

export function NativeChatComposerHostPicker({
  worktreeId,
  hostId,
  handOff,
  className,
  children
}: {
  worktreeId: string
  hostId: ExecutionHostId
  handOff: NativeChatHandOffTarget
  className?: string
  /** The machine name, as the plain footer shows it. */
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={handOff.disabled}
          className={cn('h-5.5 min-w-0 shrink justify-start', className)}
          aria-label={t(
            'components.native-chat.composerWorkspace.handOffEnvironment',
            'Hand off to another environment'
          )}
        >
          <Server className="size-3 shrink-0" aria-hidden />
          {children}
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-72">
        {/* Mounted only while open: the list reads hosts, projects and workspaces. */}
        <HostPickerRows worktreeId={worktreeId} hostId={hostId} onPick={handOff.openTo} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HostPickerRows({
  worktreeId,
  hostId,
  onPick
}: {
  worktreeId: string
  hostId: ExecutionHostId
  onPick: (environmentKey: string) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const destinations = useHandoffDestinations(worktreeId, hostId)
  const current = destinations?.[0]
  if (!destinations || !current) {
    return null
  }
  const label = t('components.agentSessionContinuation.environment.label', 'Environment')
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup aria-label={label} value={current.key}>
        {destinations.map((row) => (
          <DropdownMenuRadioItem
            key={row.key}
            value={row.key}
            disabled={!isPickableHandoffDestination(row)}
            onSelect={() => {
              if (row.kind !== 'current') {
                onPick(row.key)
              }
            }}
          >
            <span className="grid min-w-0 flex-1 gap-0.5 py-0.5">
              <span className="truncate">{row.hostLabel}</span>
              <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                {row.block && row.block.kind !== 'branch-missing'
                  ? handoffBlockText(t, row.block)
                  : handoffRowDetail(t, row)}
              </span>
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}
