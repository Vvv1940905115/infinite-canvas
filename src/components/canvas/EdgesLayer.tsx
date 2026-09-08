import type { CanvasEdgeItem, CanvasNodeItem } from "@/pages/Canvas/useCanvas"

interface LinkDraft {
  fromId: string
  x: number
  y: number
  direction?: "left" | "right"
}

interface EdgesLayerProps {
  edges: CanvasEdgeItem[]
  nodes: CanvasNodeItem[]
  selectedEdgeId: string | null
  linkDraft: LinkDraft | null
  onSelectEdge: (id: string) => void
}

function anchorFrom(n: CanvasNodeItem) {
  return { x: n.x + n.w, y: n.y + n.h / 2 }
}

function anchorTo(n: CanvasNodeItem) {
  return { x: n.x, y: n.y + n.h / 2 }
}

function curvePath(x1: number, y1: number, x2: number, y2: number, straight = false) {
  if (straight) return `M ${x1} ${y1} L ${x2} ${y2}`
  const dx = Math.min(160, Math.max(40, Math.abs(x2 - x1) * 0.5))
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

export function EdgesLayer({ edges, nodes, selectedEdgeId, linkDraft, onSelectEdge }: EdgesLayerProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const draftFrom = linkDraft ? byId.get(linkDraft.fromId) : undefined
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden={false}>
      <defs>
        <marker id="edge-arrow" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="hsl(var(--foreground) / 0.45)" />
        </marker>
        <marker id="edge-arrow-active" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="hsl(var(--primary))" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const from = byId.get(edge.from)
        const to = byId.get(edge.to)
        if (!from || !to) return null
        const a = anchorFrom(from)
        const b = anchorTo(to)
        const path = curvePath(a.x, a.y, b.x, b.y)
        const active = edge.id === selectedEdgeId
        return (
          <g key={edge.id}>
            <path
              d={path}
              fill="none"
              stroke={active ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.35)"}
              strokeWidth={active ? 2.5 : 1.5}
              markerEnd={active ? "url(#edge-arrow-active)" : "url(#edge-arrow)"}
            />
            {/* 加宽的透明命中层，方便点选连线 */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onSelectEdge(edge.id)
              }}
            />
          </g>
        )
      })}
      {draftFrom && linkDraft && (
        <path
          d={curvePath(
            linkDraft.direction === "left" ? draftFrom.x : draftFrom.x + draftFrom.w,
            draftFrom.y + draftFrom.h / 2,
            linkDraft.x,
            linkDraft.y,
            true,
          )}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="6 4"
          markerEnd="url(#edge-arrow-active)"
        />
      )}
    </svg>
  )
}
