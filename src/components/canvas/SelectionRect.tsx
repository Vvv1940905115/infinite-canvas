import type { MarqueeRect } from "@/pages/Canvas/useCanvas"

interface SelectionRectProps {
  rect: MarqueeRect
}

export function SelectionRect({ rect }: SelectionRectProps) {
  const rectLeft = Math.min(rect.x0, rect.x1)
  const rectTop = Math.min(rect.y0, rect.y1)
  const rectWidth = Math.abs(rect.x1 - rect.x0)
  const rectHeight = Math.abs(rect.y1 - rect.y0)
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 rounded-md border border-primary bg-primary/10 shadow-md"
      style={{ left: rectLeft, top: rectTop, width: rectWidth, height: rectHeight }}
    />
  )
}
