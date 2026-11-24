import React, { useState } from 'react'
import { DropdownMenuItem, useDropdownMenuClose } from '@/components/ui/dropdown-menu'
import type { TabBarCreateRowItem } from './tab-bar-create-row-item'
import { TabBarCreateRowIcons } from './TabBarCreateRowIcons'
import { useCreateRowScroller } from './use-create-row-scroller'
import { useCreateRowHoverTooltip } from './use-create-row-hover-tooltip'

/**
 * The + menu's create row where it picks a default instead of opening: the chosen icon keeps a
 * check, and there is no customizer. ←/→ walk the icons, Enter picks.
 */
export function TabBarCreateRowPicker({
  items,
  checkedId,
  label
}: {
  items: readonly TabBarCreateRowItem[]
  checkedId: string | null
  label: string
}): React.JSX.Element {
  const closeMenu = useDropdownMenuClose()
  const hoverTooltip = useCreateRowHoverTooltip()
  const { scrollerRef, attachScroller, overflow, revealIcon } = useCreateRowScroller()
  const [activeIndex, setActiveIndex] = useState(0)
  const [keyboardNav, setKeyboardNav] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const active = Math.min(activeIndex, items.length - 1)
  const run = (item: TabBarCreateRowItem): void => {
    item.run()
    closeMenu()
  }
  const move = (index: number): void => {
    setActiveIndex(index)
    revealIcon(index)
  }
  return (
    <DropdownMenuItem
      variant="icon-row"
      aria-label={label}
      onSelect={(event) => event.preventDefault()}
      onFocus={() => setKeyboardNav(true)}
      onBlur={() => setKeyboardNav(false)}
      onPointerMove={() => setKeyboardNav(false)}
      onKeyDown={(event) => {
        setKeyboardNav(true)
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          move(Math.max(0, active - 1))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          move(Math.min(items.length - 1, active + 1))
        } else if ((event.key === 'Enter' || event.key === ' ') && items[active]) {
          event.preventDefault()
          run(items[active])
        }
      }}
    >
      <TabBarCreateRowIcons
        items={items}
        checkedIndex={items.findIndex((item) => item.id === checkedId)}
        highlightedIndex={keyboardNav ? active : hoveredIndex}
        tooltipIndex={keyboardNav ? active : hoverTooltip.tooltipIndex}
        overflow={overflow}
        scrollerRef={scrollerRef}
        attachScroller={attachScroller}
        onEscape={closeMenu}
        onHover={(index, pressed) => {
          setHoveredIndex(index)
          hoverTooltip.hover(index, pressed)
        }}
        onPress={hoverTooltip.press}
        onRun={run}
      />
      <span className="sr-only" aria-live="polite">
        {keyboardNav ? items[active]?.label : ''}
      </span>
    </DropdownMenuItem>
  )
}
