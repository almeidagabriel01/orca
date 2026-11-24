import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function readCollapsed(storageKey: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Whether a host's section is folded, remembered per host across popover opens and restarts. */
export function useHostSectionCollapsed(
  storageKey: string,
  hostId: string
): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey).includes(hostId))
  const toggle = (): void => {
    const next = !collapsed
    const others = readCollapsed(storageKey).filter((id) => id !== hostId)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next ? [...others, hostId] : others))
    } catch {
      // Storage can be full or blocked; the fold still works for this session.
    }
    setCollapsed(next)
  }
  return [collapsed, toggle]
}

/** A host's collapsible section under the project list; the fold is remembered per host. */
export function ResourceHostSection({
  hostId,
  storageKey,
  title,
  tooltip,
  expandLabel,
  collapseLabel,
  trailing,
  children
}: {
  hostId: string
  storageKey: string
  title: string
  tooltip: string
  expandLabel: string
  collapseLabel: string
  trailing?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const [collapsed, toggleCollapsed] = useHostSectionCollapsed(storageKey, hostId)
  return (
    <div className="border-t border-border/50">
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="py-2 pl-2 pr-0.5 transition-colors hover:bg-muted/50"
          aria-expanded={!collapsed}
          aria-label={collapsed ? expandLabel : collapseLabel}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 cursor-default truncate text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-64">
              {tooltip}
            </TooltipContent>
          </Tooltip>
          {trailing}
        </div>
      </div>
      {!collapsed && <div className="border-t border-border/30">{children}</div>}
    </div>
  )
}
