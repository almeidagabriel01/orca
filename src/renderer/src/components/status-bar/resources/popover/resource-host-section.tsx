import React, { useEffect, useState } from 'react'
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

const SET_ALL_EVENT = 'orca:resource-host-sections-set-all'

function writeCollapsed(storageKey: string, hostId: string, collapsed: boolean): void {
  const others = readCollapsed(storageKey).filter((id) => id !== hostId)
  try {
    localStorage.setItem(storageKey, JSON.stringify(collapsed ? [...others, hostId] : others))
  } catch {
    // Storage can be full or blocked; the fold still works for this session.
  }
}

/** Folds or unfolds every host card and host section that is mounted. */
export function setAllHostSectionsCollapsed(collapsed: boolean): void {
  window.dispatchEvent(new CustomEvent<boolean>(SET_ALL_EVENT, { detail: collapsed }))
}

/** Whether a host's section is folded, remembered per host across popover opens and restarts. */
export function useHostSectionCollapsed(
  storageKey: string,
  hostId: string
): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey).includes(hostId))
  const apply = (next: boolean): void => {
    writeCollapsed(storageKey, hostId, next)
    setCollapsed(next)
  }
  useEffect(() => {
    const onSetAll = (event: Event): void => {
      if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
        writeCollapsed(storageKey, hostId, event.detail)
        setCollapsed(event.detail)
      }
    }
    window.addEventListener(SET_ALL_EVENT, onSetAll)
    return () => window.removeEventListener(SET_ALL_EVENT, onSetAll)
  }, [storageKey, hostId])
  return [collapsed, () => apply(!collapsed)]
}

/** A fold that is not per host, remembered across popover opens and restarts; folded by default. */
export function useRememberedFold(
  storageKey: string
): [collapsed: boolean, setCollapsed: React.Dispatch<React.SetStateAction<boolean>>] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== 'false'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(collapsed))
    } catch {
      // Storage can be full or blocked; the fold still works for this session.
    }
  }, [storageKey, collapsed])
  return [collapsed, setCollapsed]
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
