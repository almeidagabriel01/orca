// A one-line label that loses its middle, not its end, when it doesn't fit: measured, so the "…" sits
// right against both halves.
import React, { useLayoutEffect, useRef, useState } from 'react'
import { middleEllipsis } from './middle-ellipsis'

type Box = { width: number; font: string; letterSpacing: string }

let measureContext: CanvasRenderingContext2D | null | undefined

function textWidth(text: string, box: Box): number | null {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) {
    return null
  }
  measureContext.font = box.font
  // Why: canvas ignores CSS letter-spacing (the app body sets 0.01em); unmeasured, a long label came
  // out a few px too wide and the span's end-truncation added a second "…".
  measureContext.letterSpacing = box.letterSpacing === 'normal' ? '0px' : box.letterSpacing
  return measureContext.measureText(text).width
}

export function MiddleEllipsisLabel({ text }: { text: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const read = (width: number): Box => {
      const style = getComputedStyle(element)
      return { width, font: style.font, letterSpacing: style.letterSpacing }
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0
      setBox((previous) => (previous?.width === width ? previous : read(width)))
    })
    observer.observe(element)
    // Why: a width measured with the fallback font is wrong once the web font arrives.
    let live = true
    void document.fonts?.ready.then(() => live && setBox(read(element.clientWidth)))
    return () => {
      live = false
      observer.disconnect()
    }
  }, [])
  const shown =
    box === null || textWidth('', box) === null
      ? text
      : middleEllipsis(text, (candidate) => (textWidth(candidate, box) ?? 0) <= box.width)
  // Plain end truncation stays as the fallback until it is measured.
  return (
    <span ref={ref} className="block min-w-0 flex-1 truncate whitespace-pre">
      {shown}
    </span>
  )
}
