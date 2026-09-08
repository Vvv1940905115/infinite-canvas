import { NODE_KINDS, NODE_META, RESOURCE_KINDS, type NodeKind } from "./nodeTypes"

interface AddMenuProps {
  open: boolean
  onPick: (kind: NodeKind) => void
  onClose: () => void
}

export function AddMenu({ open, onPick, onClose }: AddMenuProps) {
  if (!open) return null
  return (
    <>
      {/* 菜单外点击 = 关闭 */}
      <div className="absolute inset-0 z-40 cursor-default" onClick={onClose} aria-hidden />
      <div className="absolute left-20 top-1/2 z-50 w-64 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="px-4 pb-1.5 pt-3 text-xs font-semibold tracking-widest text-muted-foreground">
          添加节点
        </div>
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {NODE_KINDS.map((kind) => {
            const meta = NODE_META[kind]
            const Icon = meta.icon
            return (
              <button
                key={kind}
                type="button"
                title={meta.hint}
                onClick={() => onPick(kind)}
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </button>
            )
          })}
        </div>
        <div className="border-t border-border px-4 pb-1.5 pt-2.5 text-xs font-semibold tracking-widest text-muted-foreground">
          添加资源
        </div>
        <div className="space-y-0.5 px-2 pb-2">
          {RESOURCE_KINDS.map((kind) => {
            const meta = NODE_META[kind]
            const Icon = meta.icon
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onPick(kind)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {meta.label}
                <span className="ml-auto text-xs text-muted-foreground">{meta.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
