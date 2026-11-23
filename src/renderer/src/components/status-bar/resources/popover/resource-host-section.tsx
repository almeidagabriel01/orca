import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A host's collapsible section under the project list; collapse state lives in the caller's set, so it survives popover opens. */
export function ResourceHostSection({
  hostId,
  collapsedHosts,
  title,
  tooltip,
  expandLabel,
  collapseLabel,
  trailing,
  children
}: {
  hostId: string
  collapsedHosts: Set<string>
  title: string
  tooltip: string
  expandLabel: string
  collapseLabel: string
  trailing?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(() => collapsedHosts.has(hostId))
  const toggleCollapsed = (): void => {
    if (!collapsedHosts.delete(hostId)) {
      collapsedHosts.add(hostId)
    }
    setCollapsed(collapsedHosts.has(hostId))
  }
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
              <span className="min-w-0 cursor-default truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
