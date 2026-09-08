import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { NODE_KINDS, NODE_META, type NodeKind } from "./nodeTypes"

interface ContextMenuProps {
  x: number
  y: number
  canUndo: boolean
  canRedo: boolean
  hasClipboard: boolean
  onUpload: () => void
  onAddKind: (kind: NodeKind) => void
  onUndo: () => void
  onRedo: () => void
  onCopyAll: () => void
  onPaste: () => void
  onClose: () => void
}

function MenuItem({
  label,
  shortcut,
  disabled,
  onClick,
  trailing,
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-primary/15",
      )}
    >
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="font-mono text-xs text-muted-foreground">{shortcut}</span>
      )}
      {trailing}
    </button>
  )
}

function Divider() {
  return <div className="mx-2 my-1 h-px bg-border" />
}

export function ContextMenu({
  x,
  y,
  canUndo,
  canRedo,
  hasClipboard,
  onUpload,
  onAddKind,
  onUndo,
  onRedo,
  onCopyAll,
  onPaste,
  onClose,
}: ContextMenuProps) {
  const [subOpen, setSubOpen] = useState(false)
  // 粗略夹取，避免菜单溢出视口
  const menuLeft = Math.max(8, Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 250))
  const menuTop = Math.max(8, Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 330))
  return (
    <>
      <div
        className="absolute inset-0 z-40"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="absolute z-50 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-2xl"
        style={{ left: menuLeft, top: menuTop }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MenuItem label="上传" onClick={onUpload} />
        <MenuItem
          label="添加节点"
          onClick={() => setSubOpen((v) => !v)}
          trailing={<ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", subOpen && "rotate-90")} />}
        />
        {subOpen && (
          <div className="mx-1 mb-1 grid grid-cols-2 gap-1 rounded-lg bg-card/60 p-1.5">
            {NODE_KINDS.map((kind) => {
              const meta = NODE_META[kind]
              const Icon = meta.icon
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onAddKind(kind)}
                  className="flex flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              )
            })}
          </div>
        )}
        <Divider />
        <MenuItem label="撤销" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
        <MenuItem label="重做" shortcut="Shift+Ctrl+Z" disabled={!canRedo} onClick={onRedo} />
        <Divider />
        <MenuItem label="复制所有节点" onClick={onCopyAll} />
        <MenuItem label="粘贴" shortcut="Ctrl+V" disabled={!hasClipboard} onClick={onPaste} />
      </div>
    </>
  )
}
