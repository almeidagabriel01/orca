import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/** A queue menu action; an off one says why under its label, never only on hover. */
export function QueueMenuItem({
  icon: Icon,
  label,
  reason,
  destructive,
  quiet,
  onSelect
}: {
  icon: LucideIcon
  label: string
  /** The reason is already said once above the group; keep it in the accessible name only. */
  quiet?: boolean
  /** Why it is off; null when offered. Shown under the label, not only on hover. */
  reason: string | null
  destructive?: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <DropdownMenuItem
      disabled={reason !== null}
      variant={destructive ? 'destructive' : 'default'}
      aria-label={reason ? `${label}. ${reason}` : undefined}
      onSelect={onSelect}
      className="items-start"
    >
      <Icon className="mt-0.5" />
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {reason && !quiet && (
          <span className="text-2xs break-words text-muted-foreground">{reason}</span>
        )}
      </span>
    </DropdownMenuItem>
  )
}
