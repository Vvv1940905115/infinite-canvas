import type { CanvasMode } from "@/pages/Canvas/useCanvas"

interface CanvasStatusBarProps {
  zoomPercent: number
  nodeCount: number
  selectedCount: number
  canvasMode: CanvasMode
}

export function CanvasStatusBar({ zoomPercent, nodeCount, selectedCount, canvasMode }: CanvasStatusBarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-border bg-popover/90 px-5 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
      <span className="font-mono text-sm font-semibold text-primary">{zoomPercent}%</span>
      <span className="h-3 w-px bg-border" />
      <span>
        {nodeCount} 个节点{selectedCount > 0 ? ` · 已选 ${selectedCount} 个` : ""}
      </span>
      <span className="h-3 w-px bg-border" />
      <span>{canvasMode === "move" ? "空白拖拽平移" : "空白拖拽框选"}</span>
      <span className="hidden items-center gap-1.5 md:inline-flex">
        双击编辑 · 悬停节点拖右圆点连线
        <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-xs">Shift</kbd>
        框选
        <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-xs">Delete</kbd>
        删除
      </span>
    </div>
  )
}
