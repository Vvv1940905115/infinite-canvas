import { X } from "lucide-react"

interface HelpPanelProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: { label: string; keys: string }[] = [
  { label: "撤销", keys: "Ctrl + Z" },
  { label: "重做", keys: "Shift + Ctrl + Z" },
  { label: "复制所有节点", keys: "Ctrl + C" },
  { label: "粘贴", keys: "Ctrl + V" },
  { label: "删除选中节点 / 组", keys: "Delete" },
  { label: "框选节点", keys: "空白拖拽（框选模式）" },
  { label: "平移画布", keys: "空白拖拽（移动模式）" },
  { label: "缩放画布", keys: "滚轮" },
]

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  if (!open) return null
  return (
    <div className="absolute right-4 top-20 z-40 w-72 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">帮助 · 快捷键</span>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between text-xs">
            <span className="text-popover-foreground">{s.label}</span>
            <span className="rounded bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {s.keys}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
