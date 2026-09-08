import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { ChevronDown, ChevronRight, Folder, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CanvasGroup } from "@/pages/Canvas/useCanvas"

interface GroupLayerProps {
  groups: CanvasGroup[]
  selectedGroupId: string | null
  onHeaderPointerDown: (e: ReactPointerEvent, group: CanvasGroup) => void
  onToggle: (id: string) => void
  onRename: (id: string, name: string) => void
  onUngroup: (id: string) => void
}

/**
 * 组头层：渲染在每个组的包围盒顶部，展示自定义组名、成员数量，
 * 支持折叠 / 展开、双击重命名、解散。组内节点可在 CanvasNode 层整体拖动。
 */
export function GroupLayer({
  groups,
  selectedGroupId,
  onHeaderPointerDown,
  onToggle,
  onRename,
  onUngroup,
}: GroupLayerProps) {
  return (
    <>
      {groups.map((g) => (
        <GroupHeader
          key={g.id}
          group={g}
          selected={selectedGroupId === g.id}
          onHeaderPointerDown={onHeaderPointerDown}
          onToggle={onToggle}
          onRename={onRename}
          onUngroup={onUngroup}
        />
      ))}
    </>
  )
}

function GroupHeader({
  group,
  selected,
  onHeaderPointerDown,
  onToggle,
  onRename,
  onUngroup,
}: {
  group: CanvasGroup
  selected: boolean
  onHeaderPointerDown: (e: ReactPointerEvent, g: CanvasGroup) => void
  onToggle: (id: string) => void
  onRename: (id: string, name: string) => void
  onUngroup: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    onRename(group.id, draft)
    setEditing(false)
  }

  return (
    <div
      onPointerDown={(e) => onHeaderPointerDown(e, group)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setDraft(group.name)
        setEditing(true)
      }}
      className={cn(
        "group pointer-events-auto absolute flex h-8 items-center gap-1.5 rounded-xl border px-2.5 shadow-lg transition-colors",
        selected
          ? "border-primary/60 bg-primary/15"
          : "border-border bg-popover/90 hover:border-foreground/30",
      )}
      style={{ left: group.x, top: group.y, width: group.w }}
    >
      <button
        type="button"
        aria-label={group.collapsed ? "展开组" : "折叠组"}
        title={group.collapsed ? "展开组" : "折叠组"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(group.id)
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
      >
        {group.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(group.name)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {group.name}
        </span>
      )}

      <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {group.nodeIds.length}
      </span>

      <button
        type="button"
        aria-label="解散组"
        title="解散组"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onUngroup(group.id)
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
