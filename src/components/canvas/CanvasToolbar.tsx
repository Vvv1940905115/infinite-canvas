import {
  BoxSelect,
  Folder,
  HelpCircle,
  History,
  Maximize,
  MousePointer2,
  Plus,
  Sparkles,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CanvasMode } from "@/pages/Canvas/useCanvas"

interface ToolButtonProps {
  label: string
  active?: boolean
  onClick: () => void
  icon: LucideIcon
}

function ToolButton({ label, active, onClick, icon: Icon }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

interface CanvasToolbarProps {
  canvasMode: CanvasMode
  menuOpen: boolean
  onToggleMenu: () => void
  aiMenuOpen: boolean
  onToggleAiMenu: () => void
  onSetMode: (mode: CanvasMode) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onOpenAssetLibrary: () => void
  onOpenHistory: () => void
  onOpenHelp: () => void
}

export function CanvasToolbar({
  canvasMode,
  menuOpen,
  onToggleMenu,
  aiMenuOpen,
  onToggleAiMenu,
  onSetMode,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenAssetLibrary,
  onOpenHistory,
  onOpenHelp,
}: CanvasToolbarProps) {
  return (
    <div className="absolute left-4 top-1/2 z-30 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-popover/90 p-2 shadow-2xl backdrop-blur">
        <button
          type="button"
          aria-label="添加节点"
          title="添加节点（AI 生成）"
          onClick={onToggleAiMenu}
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className={cn("h-5 w-5 transition-transform duration-200", aiMenuOpen && "rotate-45")} />
        </button>
        <button
          type="button"
          aria-label="素材导入"
          title="素材导入：上传本地图片/视频或从历史作品导入"
          onClick={onToggleMenu}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            menuOpen
              ? "bg-foreground text-background"
              : "bg-popover text-foreground hover:bg-primary/15",
          )}
        >
          <Sparkles className={cn("h-5 w-5 transition-transform duration-200", menuOpen && "rotate-45")} />
        </button>
        <div className="h-px w-6 bg-border" />
        <ToolButton
          label="移动模式：空白处拖拽平移画布"
          active={canvasMode === "move"}
          onClick={() => onSetMode("move")}
          icon={MousePointer2}
        />
        <ToolButton
          label="框选模式：空白处拖拽框选节点"
          active={canvasMode === "select"}
          onClick={() => onSetMode("select")}
          icon={BoxSelect}
        />
        <div className="h-px w-6 bg-border" />
        <ToolButton label="放大" onClick={onZoomIn} icon={ZoomIn} />
        <ToolButton label="缩小" onClick={onZoomOut} icon={ZoomOut} />
        <ToolButton label="重置视图" onClick={onResetView} icon={Maximize} />
        <div className="h-px w-6 bg-border" />
        <ToolButton label="资源库" onClick={onOpenAssetLibrary} icon={Folder} />
        <ToolButton label="操作历史" onClick={onOpenHistory} icon={History} />
        <ToolButton label="帮助" onClick={onOpenHelp} icon={HelpCircle} />
      </div>
    </div>
  )
}
