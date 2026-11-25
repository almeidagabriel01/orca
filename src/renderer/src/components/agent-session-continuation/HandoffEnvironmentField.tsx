import { useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  HandoffDestination,
  HandoffDestinationBlock
} from '@/lib/agent-session/launch/continuation/handoff-destinations'

const KEY = 'components.agentSessionContinuation.environment'

function blockText(t: Translate, row: HandoffDestination, block: HandoffDestinationBlock): string {
  switch (block.kind) {
    case 'host-unavailable':
      return block.detail
    case 'project-missing':
      return t(`${KEY}.projectMissing`, 'This project is not set up on this host. {{detail}}', {
        detail: block.detail
      })
    case 'branch-missing':
      return t(
        `${KEY}.branchMissing`,
        'No workspace on {{branch}} on this host. Create one there first.',
        { branch: row.branch ?? '' }
      )
    case 'folder-source':
      return t(
        `${KEY}.folderSource`,
        'A folder workspace has no branch to continue on another host.'
      )
    case 'detached-source':
      return t(`${KEY}.detachedSource`, 'This workspace is not on a branch.')
  }
}

function rowDetail(t: Translate, row: HandoffDestination): string {
  return row.kind === 'current'
    ? t(`${KEY}.current`, 'this workspace')
    : t(`${KEY}.sameBranch`, 'workspace on the same branch')
}

/** Where the hand-off starts. Hidden when there is no other host to pick. */
export function HandoffEnvironmentField({
  destinations,
  value,
  onChange,
  disabled
}: {
  destinations: readonly HandoffDestination[]
  value: string
  onChange: (key: string) => void
  disabled?: boolean
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
        className="gap-1.5"
      >
        {destinations.map((row) => (
          <label
            key={row.key}
            className={cn(
              'flex min-w-0 items-start gap-2.5 rounded-md border border-border px-3 py-2',
              row.key === value && 'border-foreground/40 bg-accent',
              row.block && 'opacity-60'
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
                {rowDetail(t, row)}
              </span>
              {row.block ? (
                <span className="text-xs break-words text-status-warning-text">
                  {blockText(t, row, row.block)}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
