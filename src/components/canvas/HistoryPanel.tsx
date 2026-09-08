import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HistoryPanelProps {
  open: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClose: () => void
}

export function HistoryPanel({ open, canUndo, canRedo, onUndo, onRedo, onClose }: HistoryPanelProps) {
  if (!open) return null
  return (
    <div className="absolute right-4 top-20 z-40 w-72 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">操作历史</span>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        当前画布支持撤销 / 重做。也可以通过快捷键 Ctrl+Z 撤销、Shift+Ctrl+Z 重做。
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!canUndo}
          onClick={onUndo}
        >
          撤销
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!canRedo}
          onClick={onRedo}
        >
          重做
        </Button>
      </div>
    </div>
  )
}
