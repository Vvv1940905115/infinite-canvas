import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { NODE_META, type NodeKind } from "./nodeTypes"

export interface PortLinkOption {
  kind: NodeKind
  label: string
}

interface PortLinkMenuProps {
  open: boolean
  title: string
  options: PortLinkOption[]
  x: number
  y: number
  onPick: (kind: NodeKind) => void
  onClose: () => void
}

export function PortLinkMenu({ open, title, options, x, y, onPick, onClose }: PortLinkMenuProps) {
  if (!open) return null

  return (
    <>
      {/* 点击遮罩关闭 */}
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed z-50 w-52 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl",
          "pointer-events-auto",
        )}
        style={{ left: x, top: y, transform: "translateY(-50%)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-0.5 p-1.5">
          {options.map(({ kind, label }) => {
            const Icon = NODE_META[kind].icon
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onPick(kind)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary-foreground transition-colors",
                  "hover:bg-primary/15 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
