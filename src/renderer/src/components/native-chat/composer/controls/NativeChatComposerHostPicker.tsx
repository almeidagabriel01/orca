// The composer footer's host: a menu that continues this conversation on another host through the hand-off.
import { ChevronDown, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { NativeChatContinueOnHostItems } from '../../pane/actions/NativeChatContinueOnHostItems'
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
            'Continue on another host'
          )}
        >
          <Server className="size-3 shrink-0" aria-hidden />
          {children}
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-72">
        {/* Mounted only while open: the list reads hosts, projects and workspaces. */}
        <HostPickerRows worktreeId={worktreeId} hostId={hostId} handOff={handOff} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HostPickerRows({
  worktreeId,
  hostId,
  handOff
}: {
  worktreeId: string
  hostId: ExecutionHostId
  handOff: NativeChatHandOffTarget
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <>
      <DropdownMenuLabel>
        {t(
          'components.agentSessionContinuation.continueConversation',
          'Continue this conversation'
        )}
      </DropdownMenuLabel>
      <NativeChatContinueOnHostItems worktreeId={worktreeId} hostId={hostId} handOff={handOff} />
    </>
  )
}
