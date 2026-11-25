import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogError } from '@/components/ui/dialog-parts'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  HandoffDestination,
  HandoffDestinationBlock
} from '@/lib/agent-session/launch/continuation/handoff-destinations'
import { HandoffSourceChanges } from './HandoffSourceChanges'
import type { HandoffDestinationCreation, HandoffEnvironment } from './use-handoff-environment'

const KEY = 'components.agentSessionContinuation.environment'

/** Why a row cannot be picked as is, as its row spells it out. */
export function handoffBlockText(t: Translate, block: HandoffDestinationBlock): string {
  switch (block.kind) {
    case 'branch-missing':
      return t(`${KEY}.noWorkspaceYet`, 'no workspace on this branch yet')
    case 'host-unavailable':
      return block.detail
    case 'project-missing':
      return t(`${KEY}.projectMissing`, 'This project is not set up on this host. {{detail}}', {
        detail: block.detail
      })
    case 'folder-source':
      return t(
        `${KEY}.folderSource`,
        'A folder workspace has no branch to continue on another host.'
      )
    case 'detached-source':
      return t(`${KEY}.detachedSource`, 'This workspace is not on a branch.')
  }
}

/** The row's state: this workspace, a same-branch workspace, or none there yet. */
export function handoffRowDetail(t: Translate, row: HandoffDestination): string {
  if (row.kind === 'current') {
    return t(`${KEY}.current`, 'this workspace')
  }
  return row.block?.kind === 'branch-missing'
    ? t(`${KEY}.noWorkspaceYet`, 'no workspace on this branch yet')
    : t(`${KEY}.sameBranch`, 'workspace on the same branch')
}

/** Where the hand-off starts. Hidden when there is no other host to pick. */
export function HandoffEnvironmentField({
  destinations,
  value,
  onChange,
  disabled,
  creation,
  onCreate
}: {
  destinations: readonly HandoffDestination[]
  value: string
  onChange: (key: string) => void
  disabled?: boolean
  creation?: HandoffDestinationCreation | null
  /** Creates the missing same-branch workspace on that row's host. */
  onCreate?: (row: HandoffDestination) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const labelId = useId()
  if (destinations.length < 2) {
    return null
  }
  return (
    <div className="grid min-w-0 gap-1.5">
      <span id={labelId} className="text-[13px] font-medium">
        {t(`${KEY}.label`, 'Environment')}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        layout="rows"
      >
        <div className="grid min-w-0 gap-1.5">
          {destinations.map((row) => (
            <label
              key={row.key}
              className={cn(
                'flex min-w-0 items-start gap-2.5 rounded-md border border-border px-3 py-2',
                row.key === value && 'border-foreground/40 bg-accent',
                row.block && row.block.kind !== 'branch-missing' && 'opacity-60'
              )}
            >
              <RadioGroupItem
                value={row.key}
                disabled={disabled || row.block !== null}
                className="mt-0.5"
              />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-medium">
                  {row.hostLabel}
                  {row.kind === 'current' ? (
                    <Badge variant="hostContext">{t(`${KEY}.currentBadge`, 'Current')}</Badge>
                  ) : null}
                </span>
                <span className="text-xs break-words text-muted-foreground">
                  <span className="font-mono text-foreground/80">{row.workspaceLabel}</span>
                  {' · '}
                  {handoffRowDetail(t, row)}
                </span>
                {row.block?.kind === 'branch-missing' ? (
                  <span className="grid justify-items-start gap-1 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled || !onCreate || Boolean(creation?.running)}
                      onClick={() => onCreate?.(row)}
                    >
                      {creation?.key === row.key && creation.running ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      {t(`${KEY}.createWorkspace`, 'Create workspace on {{host}}', {
                        host: row.hostLabel
                      })}
                    </Button>
                    {creation?.key === row.key && creation.error ? (
                      <DialogError>{creation.error}</DialogError>
                    ) : null}
                  </span>
                ) : row.block ? (
                  <span className="text-xs break-words text-status-warning-text">
                    {handoffBlockText(t, row.block)}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </RadioGroup>
    </div>
  )
}

/** The dialog's environment block: picker, source changes to publish, and the destination error. */
export function HandoffEnvironmentSection({
  env,
  disabled
}: {
  env: HandoffEnvironment
  disabled: boolean
}): React.JSX.Element {
  return (
    <>
      {env.destinations ? (
        <HandoffEnvironmentField
          destinations={env.destinations}
          value={env.destinationKey}
          onChange={env.pickDestination}
          disabled={disabled}
          creation={env.creation}
          onCreate={env.createDestination}
        />
      ) : null}
      {env.elsewhere ? <HandoffSourceChanges {...env.sourceChanges} /> : null}
      {env.destinationError ? <DialogError>{env.destinationError}</DialogError> : null}
    </>
  )
}
