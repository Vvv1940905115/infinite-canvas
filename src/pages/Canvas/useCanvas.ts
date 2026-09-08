import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { NODE_META, type NodeKind } from "@/components/canvas/nodeTypes"

export type CanvasMode = "move" | "select"

export interface CameraState {
  x: number
  y: number
  scale: number
}

export interface CanvasNodeItem {
  id: string
  kind: NodeKind
  x: number
  y: number
  w: number
  h: number
  content?: string
  /** 角色/场景节点的自定义标题（未设置时显示默认名） */
  title?: string
  imageUrl?: string
  /** 角色/场景节点的 8 个加号点位各自独立的图片，键为点位索引 0-7 */
  slotImages?: Record<number, string>
}

export interface MarqueeRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface CanvasEdgeItem {
  id: string
  from: string
  to: string
}

export interface CanvasGroup {
  id: string
  name: string
  nodeIds: string[]
  collapsed: boolean
  /** 组头部卡片的世界坐标与宽度（基于成员节点包围盒顶部） */
  x: number
  y: number
  w: number
}

const MIN_SCALE = 0.2
const MAX_SCALE = 4
const GRID_SIZE = 24
const HOME_CAMERA: CameraState = { x: 150, y: 90, scale: 1 }

function clampScale(v: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v))
}

function makeNode(kind: NodeKind, worldX: number, worldY: number, serial: number): CanvasNodeItem {
  const meta = NODE_META[kind]
  return {
    id: `node-${serial}-${kind}`,
    kind,
    x: Math.round(worldX - meta.w / 2),
    y: Math.round(worldY - meta.h / 2),
    w: meta.w,
    h: meta.h,
  }
}

type DragState =
  | { mode: "pan"; startClientX: number; startClientY: number; camX: number; camY: number; moved: boolean }
  | { mode: "marquee"; startX: number; startY: number; moved: boolean }
  | { mode: "link"; fromId: string; head: { x: number; y: number }; direction: "left" | "right" }
  | {
      mode: "node"
      startClientX: number
      startClientY: number
      ids: string[]
      origins: Record<string, { x: number; y: number }>
      moved: boolean
      snapshot: { nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] }
    }

export function useCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [camera, setCamera] = useState<CameraState>(HOME_CAMERA)
  const [nodes, setNodes] = useState<CanvasNodeItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("move")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edges, setEdges] = useState<CanvasEdgeItem[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [linkDraft, setLinkDraft] = useState<{ fromId: string; x: number; y: number; direction?: "left" | "right" } | null>(null)
  const [portPopup, setPortPopup] = useState<{
    screenX: number
    screenY: number
    worldX: number
    worldY: number
    nodeId: string
    direction: "left" | "right"
  } | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [hasClipboard, setHasClipboard] = useState(false)
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false)
  const [groups, setGroups] = useState<CanvasGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)

  const cameraRef = useRef(camera)
  const nodesRef = useRef(nodes)
  const selectedRef = useRef(selectedIds)
  const edgeSelRef = useRef(selectedEdgeId)
  const modeRef = useRef(canvasMode)
  const menuOpenRef = useRef(menuOpen)
  const dragRef = useRef<DragState | null>(null)
  const pointerRef = useRef({ x: 480, y: 320 })
  // 鼠标最后一次停留在画布上的位置（菜单打开期间不更新），新节点生成在这里
  const canvasPointerRef = useRef({ x: 480, y: 320 })
  const serialRef = useRef(0)
  const editingIdRef = useRef(editingId)
  const edgesRef = useRef(edges)
  const groupsRef = useRef(groups)
  const groupSelRef = useRef(selectedGroupId)
  const pastRef = useRef<{ nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] }[]>([])
  const futureRef = useRef<{ nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] }[]>([])
  const clipboardRef = useRef<{ nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] } | null>(null)
  const editSnapRef = useRef<{ nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] } | null>(null)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    selectedRef.current = selectedIds
  }, [selectedIds])
  useEffect(() => {
    edgeSelRef.current = selectedEdgeId
  }, [selectedEdgeId])
  useEffect(() => {
    modeRef.current = canvasMode
  }, [canvasMode])
  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])
  useEffect(() => {
    editingIdRef.current = editingId
  }, [editingId])
  useEffect(() => {
    groupsRef.current = groups
  }, [groups])
  useEffect(() => {
    groupSelRef.current = selectedGroupId
  }, [selectedGroupId])

  // ---- 节点间媒体数据流：沿连线 from→to 传递，下游节点在 AI 面板显示连线传入的媒体预览（支持多上游与链路多级传递）----
  const nodeMediaMap = useMemo(() => {
    const map: Record<string, { url: string; kind: NodeKind }[]> = {}
    const mediaOf = (id: string): { url: string; kind: NodeKind }[] => {
      const n = nodes.find((nn) => nn.id === id)
      const own: { url: string; kind: NodeKind }[] = []
      if (n?.imageUrl) own.push({ url: n.imageUrl, kind: n.kind })
      if (n?.slotImages?.[0]) own.push({ url: n.slotImages[0], kind: n.kind })
      if (own.length > 0) return own
      return map[id] ?? []
    }
    let changed = true
    while (changed) {
      changed = false
      for (const edge of edges) {
        const src = mediaOf(edge.from)
        const prev = map[edge.to] ?? []
        const merged = [...prev]
        for (const m of src) {
          if (!merged.some((x) => x.url === m.url)) merged.push(m)
        }
        if (merged.length !== prev.length) {
          map[edge.to] = merged
          changed = true
        }
      }
    }
    return map
  }, [nodes, edges])

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return { x: clientX, y: clientY }
    const rect = el.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  // ---- 撤销 / 重做：快照式历史 ----
  const pushPast = useCallback((snap: { nodes: CanvasNodeItem[]; edges: CanvasEdgeItem[] }) => {
    pastRef.current = [...pastRef.current.slice(-49), snap]
    futureRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const commitHistory = useCallback(() => {
    pushPast({ nodes: nodesRef.current, edges: edgesRef.current })
  }, [pushPast])

  const undo = useCallback(() => {
    const prev = pastRef.current[pastRef.current.length - 1]
    if (!prev) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, { nodes: nodesRef.current, edges: edgesRef.current }]
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setEditingId(null)
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(true)
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1]
    if (!next) return
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, { nodes: nodesRef.current, edges: edgesRef.current }]
    setNodes(next.nodes)
    setEdges(next.edges)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setEditingId(null)
    setCanRedo(futureRef.current.length > 0)
    setCanUndo(true)
  }, [])

  // ---- 复制所有节点 / 粘贴 ----
  const copyAllNodes = useCallback(() => {
    clipboardRef.current = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      edges: edgesRef.current.map((e) => ({ ...e })),
    }
    setHasClipboard(true)
  }, [])

  const pasteNodes = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip || clip.nodes.length === 0) return
    commitHistory()
    const idMap = new Map<string, string>()
    const newNodes = clip.nodes.map((n) => {
      serialRef.current += 1
      const nid = `node-${serialRef.current}-${n.kind}`
      idMap.set(n.id, nid)
      return { ...n, id: nid, x: n.x + 36, y: n.y + 28 }
    })
    const newEdges = clip.edges
      .filter((ed) => idMap.has(ed.from) && idMap.has(ed.to))
      .map((ed) => ({
        id: `edge-${idMap.get(ed.from)}->${idMap.get(ed.to)}`,
        from: idMap.get(ed.from) as string,
        to: idMap.get(ed.to) as string,
      }))
    setNodes((list) => [...list, ...newNodes])
    setEdges((list) => [...list, ...newEdges.filter((ne) => !list.some((ed) => ed.from === ne.from && ed.to === ne.to))])
    setSelectedIds(newNodes.map((n) => n.id))
  }, [commitHistory])

  // ---- 右键菜单 ----
  const onBackgroundContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const p = toLocal(e.clientX, e.clientY)
      const cam = cameraRef.current
      setMenuOpen(false)
      setAiMenuOpen(false)
      setContextMenu({ x: p.x, y: p.y, worldX: (p.x - cam.x) / cam.scale, worldY: (p.y - cam.y) / cam.scale })
    },
    [toLocal],
  )
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // 滚轮缩放：以鼠标当前位置为中心，限制 0.2 ~ 4 倍
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setCamera((cam) => {
        const next = clampScale(cam.scale * Math.exp(-e.deltaY * 0.0016))
        if (next === cam.scale) return cam
        const wx = (sx - cam.x) / cam.scale
        const wy = (sy - cam.y) / cam.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const handleWindowMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (drag.mode === "pan") {
        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
        setCamera((cam) => ({ ...cam, x: drag.camX + dx, y: drag.camY + dy }))
      } else if (drag.mode === "marquee") {
        const p = toLocal(e.clientX, e.clientY)
        if (Math.abs(p.x - drag.startX) + Math.abs(p.y - drag.startY) > 4) drag.moved = true
        setMarquee({ x0: drag.startX, y0: drag.startY, x1: p.x, y1: p.y })
      } else if (drag.mode === "link") {
        const cam = cameraRef.current
        const p = toLocal(e.clientX, e.clientY)
        drag.head = { x: (p.x - cam.x) / cam.scale, y: (p.y - cam.y) / cam.scale }
        setLinkDraft({ fromId: drag.fromId, x: drag.head.x, y: drag.head.y, direction: drag.direction })
      } else {
        const cam = cameraRef.current
        const dx = (e.clientX - drag.startClientX) / cam.scale
        const dy = (e.clientY - drag.startClientY) / cam.scale
        if (Math.abs(dx) * cam.scale + Math.abs(dy) * cam.scale > 3) drag.moved = true
        setNodes((list) =>
          list.map((n) => {
            const nodeOrigin = drag.origins[n.id]
            if (!nodeOrigin) return n
            return { ...n, x: Math.round(nodeOrigin.x + dx), y: Math.round(nodeOrigin.y + dy) }
          }),
        )
      }
    },
    [toLocal],
  )

  // ---- 连线锚点碰撞检测：判断世界坐标是否在某节点左侧或右侧锚点附近（半径24px）----
  const hitTestAnchor = useCallback(
    (worldX: number, worldY: number): { nodeId: string; side: "left" | "right" } | null => {
      const HIT_RADIUS = 30
      for (const n of nodesRef.current) {
        // 左侧锚点：节点左边缘中心
        if (Math.hypot(worldX - n.x, worldY - (n.y + n.h / 2)) <= HIT_RADIUS) {
          return { nodeId: n.id, side: "left" }
        }
        // 右侧锚点：节点右边缘中心
        if (Math.hypot(worldX - (n.x + n.w), worldY - (n.y + n.h / 2)) <= HIT_RADIUS) {
          return { nodeId: n.id, side: "right" }
        }
      }
      return null
    },
    [],
  )

  // 手动完成连线到指定目标节点（供 CanvasNode 锚点 drop 时调用）
  const completeLinkTo = useCallback(
    (targetNodeId: string, targetSide: "left" | "right") => {
      const drag = dragRef.current
      if (!drag || drag.mode !== "link") return false
      const fromId = drag.fromId
      // 不允许连接自身
      if (fromId === targetNodeId) return false
      // 方向匹配：右锚点→目标左锚点，或左锚点→目标右锚点（双向均可）
      const validRight = drag.direction === "right" && targetSide === "left"
      const validLeft = drag.direction === "left" && targetSide === "right"
      if (!validRight && !validLeft) return false
      // 始终让 from 位于视觉左侧，连线方向固定为左→右
      const from = drag.direction === "right" ? fromId : targetNodeId
      const to = drag.direction === "right" ? targetNodeId : fromId
      // 检查是否已存在相同连线
      const edgeId = `edge-${from}->${to}`
      const exists = edgesRef.current.some((e) => e.id === edgeId)
      if (exists) return false
      commitHistory()
      setEdges((list) => [...list, { id: edgeId, from, to }])
      return true
    },
    [commitHistory],
  )

  /** 直接在两个节点间建立连线（供 AI 面板「从画布选择」追加输入时调用），方向按视觉位置左→右 */
  const linkNodes = useCallback(
    (aId: string, bId: string) => {
      if (aId === bId) return
      const a = nodesRef.current.find((n) => n.id === aId)
      const b = nodesRef.current.find((n) => n.id === bId)
      if (!a || !b) return
      const from = a.x <= b.x ? a.id : b.id
      const to = from === a.id ? b.id : a.id
      const edgeId = `edge-${from}->${to}`
      if (edgesRef.current.some((e) => e.id === edgeId)) return
      commitHistory()
      setEdges((list) => [...list, { id: edgeId, from, to }])
    },
    [commitHistory],
  )

  const finishDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    setEditingId(null)
    if (drag.mode === "link") {
      const head = drag.head
      // 先尝试命中目标节点的锚点
      const hit = hitTestAnchor(head.x, head.y)
      if (hit && hit.nodeId !== drag.fromId) {
        // 方向匹配检查
        // 方向匹配：右锚点→目标左锚点，或左锚点→目标右锚点（双向均可）
        const valid =
          (drag.direction === "right" && hit.side === "left") ||
          (drag.direction === "left" && hit.side === "right")
        if (valid) {
          // 始终让 from 位于视觉左侧，连线方向固定为左→右
          const from = drag.direction === "right" ? drag.fromId : hit.nodeId
          const to = drag.direction === "right" ? hit.nodeId : drag.fromId
          const edgeId = `edge-${from}->${to}`
          const exists = edgesRef.current.some((e) => e.id === edgeId)
          if (!exists) {
            commitHistory()
            setEdges((list) => [...list, { id: edgeId, from, to }])
          }
          setLinkDraft(null)
          return
        }
      }
      // 未命中锚点 → 弹出端口菜单创建新节点
      const cam = cameraRef.current
      setPortPopup({
        screenX: head.x * cam.scale + cam.x,
        screenY: head.y * cam.scale + cam.y,
        worldX: head.x,
        worldY: head.y,
        nodeId: drag.fromId,
        direction: drag.direction,
      })
      // 保留拖拽预览线，直到用户在弹窗中点选项或关闭
      return
    }
    if (drag.mode === "node" && drag.moved) {
      pushPast(drag.snapshot)
      // 拖动结束后，重算所有受影响的组头部位置
      const movedIds = new Set(drag.ids)
      setGroups((list) =>
        list.map((g) => {
          if (!g.nodeIds.some((id) => movedIds.has(id))) return g
          const box = groupBoundingBox(g.nodeIds)
          if (!box) return g
          return { ...g, x: box.minX, y: box.minY - 34, w: Math.max(160, box.maxX - box.minX) }
        }),
      )
    }
    if (drag.mode === "marquee") {
      setMarquee((rect) => {
        if (drag.moved && rect) {
          const cam = cameraRef.current
          const wx0 = (Math.min(rect.x0, rect.x1) - cam.x) / cam.scale
          const wy0 = (Math.min(rect.y0, rect.y1) - cam.y) / cam.scale
          const wx1 = (Math.max(rect.x0, rect.x1) - cam.x) / cam.scale
          const wy1 = (Math.max(rect.y0, rect.y1) - cam.y) / cam.scale
          const hit = nodesRef.current
            .filter((n) => n.x < wx1 && n.x + n.w > wx0 && n.y < wy1 && n.y + n.h > wy0)
            .map((n) => n.id)
          setSelectedIds(hit)
        }
        return null
      })
    } else if (drag.mode === "pan" && !drag.moved) {
      // 空白处单击 = 取消选中
      setSelectedIds([])
      setSelectedEdgeId(null)
    }
  }, [commitHistory, pushPast])

  const handleWindowUp = useCallback(() => {
    finishDrag()
    window.removeEventListener("pointermove", handleWindowMove)
    window.removeEventListener("pointerup", handleWindowUp)
  }, [finishDrag, handleWindowMove])

  const beginWindowDrag = useCallback(() => {
    window.addEventListener("pointermove", handleWindowMove)
    window.addEventListener("pointerup", handleWindowUp)
  }, [handleWindowMove, handleWindowUp])

  // 空白处按下：移动模式 = 平移画布；框选模式或按住 Shift = 拉框选
  const onBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      setMenuOpen(false)
      setAiMenuOpen(false)
      setEditingId(null)
      setContextMenu(null)
      const p = toLocal(e.clientX, e.clientY)
      if (modeRef.current === "select" || e.shiftKey) {
        dragRef.current = { mode: "marquee", startX: p.x, startY: p.y, moved: false }
      } else {
        const cam = cameraRef.current
        dragRef.current = {
          mode: "pan",
          startClientX: e.clientX,
          startClientY: e.clientY,
          camX: cam.x,
          camY: cam.y,
          moved: false,
        }
      }
      beginWindowDrag()
    },
    [beginWindowDrag, toLocal],
  )

  // 节点按下：选中（Shift 加选/减选），拖动则移动节点（多选时整体移动）
  const onNodePointerDown = useCallback(
    (e: ReactPointerEvent, node: CanvasNodeItem) => {
      if (e.button !== 0) return
      e.stopPropagation()
      setMenuOpen(false)
      setAiMenuOpen(false)
      const already = selectedRef.current.includes(node.id)
      let ids: string[]
      if (e.shiftKey) {
        ids = already ? selectedRef.current.filter((i) => i !== node.id) : [...selectedRef.current, node.id]
        setSelectedIds(ids)
        if (!ids.includes(node.id)) return
      } else {
        ids = already ? selectedRef.current : [node.id]
        setSelectedIds(ids)
      }
      const startPositions: Record<string, { x: number; y: number }> = {}
      for (const n of nodesRef.current) {
        if (ids.includes(n.id)) startPositions[n.id] = { x: n.x, y: n.y }
      }
      dragRef.current = {
        mode: "node",
        startClientX: e.clientX,
        startClientY: e.clientY,
        ids,
        origins: startPositions,
        moved: false,
        snapshot: { nodes: nodesRef.current, edges: edgesRef.current },
      }
      beginWindowDrag()
    },
    [beginWindowDrag],
  )

  // 节点左右连接点按下：拖出连线，松开后弹出对应菜单
  const onLinkStart = useCallback(
    (e: ReactPointerEvent, node: CanvasNodeItem, direction: "left" | "right") => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const head =
        direction === "left"
          ? { x: node.x, y: node.y + node.h / 2 }
          : { x: node.x + node.w, y: node.y + node.h / 2 }
      dragRef.current = { mode: "link", fromId: node.id, head, direction }
      setLinkDraft({ fromId: node.id, x: head.x, y: head.y, direction })
      beginWindowDrag()
    },
    [beginWindowDrag],
  )

  const selectEdge = useCallback((id: string | null) => setSelectedEdgeId(id), [])

  const onPointerTrack = useCallback(
    (e: ReactPointerEvent) => {
      const p = toLocal(e.clientX, e.clientY)
      pointerRef.current = p
      // 菜单打开时鼠标在菜单上，不代表画布位置，不覆盖
      if (!menuOpenRef.current) canvasPointerRef.current = p
    },
    [toLocal],
  )

  // 在指定世界坐标生成节点；连续添加时斜向错开，靠近屏幕边缘时收进视口
  const createNodeAt = useCallback(
    (kind: NodeKind, worldX: number, worldY: number, imageUrl?: string, skipHistory?: boolean) => {
      const cam = cameraRef.current
      const bump = (serialRef.current % 6) * 28
      serialRef.current += 1
      const node = makeNode(kind, worldX + bump, worldY + bump * 0.7, serialRef.current)
      if (imageUrl) node.imageUrl = imageUrl
      const el = containerRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const padL = (88 - cam.x) / cam.scale
        const padT = (16 - cam.y) / cam.scale
        const padR = (rect.width - 16 - cam.x) / cam.scale
        const padB = (rect.height - 16 - cam.y) / cam.scale
        if (padR - padL > node.w) node.x = Math.min(Math.max(node.x, padL), padR - node.w)
        if (padB - padT > node.h) node.y = Math.min(Math.max(node.y, padT), padB - node.h)
      }
      if (!skipHistory) commitHistory()
      setNodes((list) => [...list, node])
      setSelectedIds([node.id])
      setMenuOpen(false)
      setAiMenuOpen(false)
      setContextMenu(null)
      return node.id
    },
    [commitHistory],
  )

  const addNodeAtPointer = useCallback(
    (kind: NodeKind) => {
      const p = canvasPointerRef.current
      const cam = cameraRef.current
      createNodeAt(kind, (p.x - cam.x) / cam.scale, (p.y - cam.y) / cam.scale)
    },
    [createNodeAt],
  )

  const closePortPopup = useCallback(() => {
    setPortPopup(null)
    setLinkDraft(null)
  }, [])

  // 从端口弹窗选中节点类型后：创建节点并自动完成连线
  const onPortLinkPick = useCallback(
    (kind: NodeKind) => {
      if (!portPopup) return
      const currentNode = nodesRef.current.find((n) => n.id === portPopup.nodeId)
      if (!currentNode) return
      commitHistory()
      const newId = createNodeAt(kind, portPopup.worldX, portPopup.worldY, undefined, true)
      if (portPopup.direction === "left") {
        // 输入端口：新建上游节点 → 当前节点
        setEdges((list) => [...list, { id: `edge-${newId}->${currentNode.id}`, from: newId, to: currentNode.id }])
      } else {
        // 输出端口：当前节点 → 新建下游节点
        setEdges((list) => [...list, { id: `edge-${currentNode.id}->${newId}`, from: currentNode.id, to: newId }])
      }
      setPortPopup(null)
      setLinkDraft(null)
    },
    [portPopup, createNodeAt, commitHistory],
  )

  // 右键菜单里添加节点 / 上传：在右键位置生成
  const addNodeAtWorld = useCallback(
    (kind: NodeKind, worldX: number, worldY: number) => {
      createNodeAt(kind, worldX, worldY)
    },
    [createNodeAt],
  )

  // ---- 上传：直接唤起本地文件选择，选完在指定画布位置生成图片节点 ----
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadRef = useRef<{ x: number; y: number } | null>(null)

  const requestUploadAtWorld = useCallback((worldX: number, worldY: number) => {
    pendingUploadRef.current = { x: worldX, y: worldY }
    setContextMenu(null)
    fileInputRef.current?.click()
  }, [])

  const requestUploadAtPointer = useCallback(() => {
    const p = canvasPointerRef.current
    const cam = cameraRef.current
    requestUploadAtWorld((p.x - cam.x) / cam.scale, (p.y - cam.y) / cam.scale)
  }, [requestUploadAtWorld])

  const onUploadFiles = useCallback(
    (e: ReactChangeEvent<HTMLInputElement>) => {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return
      const at = pendingUploadRef.current ?? { x: 240, y: 160 }
      pendingUploadRef.current = null
      const reader = new FileReader()
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : undefined
        if (!url) return
        // 按文件类型落位：视频 → 视频节点，其余（图片）→ 图片节点
        const kind: NodeKind = file.type.startsWith("video/") ? "video" : "image"
        createNodeAt(kind, at.x, at.y, url)
      }
      reader.readAsDataURL(file)
      input.value = ""
    },
    [createNodeAt],
  )

  /** 从资源库/历史作品素材导入：在指针位置按素材类型生成节点 */
  const addAssetAtPointer = useCallback(
    (asset: { category: string; name: string; path: string }) => {
      const p = canvasPointerRef.current
      const cam = cameraRef.current
      const kind: NodeKind =
        asset.category === "视频" ? "video" : asset.category === "音频" ? "audio" : "image"
      createNodeAt(kind, (p.x - cam.x) / cam.scale, (p.y - cam.y) / cam.scale, asset.path)
    },
    [createNodeAt],
  )

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current
    const rect = el?.getBoundingClientRect()
    const sx = rect ? rect.width / 2 : 480
    const sy = rect ? rect.height / 2 : 320
    setCamera((cam) => {
      const next = clampScale(cam.scale * factor)
      if (next === cam.scale) return cam
      const wx = (sx - cam.x) / cam.scale
      const wy = (sy - cam.y) / cam.scale
      return { x: sx - wx * next, y: sy - wy * next, scale: next }
    })
  }, [])

  const zoomIn = useCallback(() => zoomBy(1.25), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(0.8), [zoomBy])
  const resetView = useCallback(() => setCamera(HOME_CAMERA), [])
  const toggleMenu = useCallback(() => {
    setMenuOpen((v) => {
      const next = !v
      if (next) setAiMenuOpen(false)
      return next
    })
  }, [])
  const openMenu = useCallback(() => {
    setAiMenuOpen(false)
    setMenuOpen(true)
  }, [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const toggleAiMenu = useCallback(() => {
    setAiMenuOpen((v) => {
      const next = !v
      if (next) setMenuOpen(false)
      return next
    })
  }, [])
  const openAiMenu = useCallback(() => {
    setMenuOpen(false)
    setAiMenuOpen(true)
  }, [])
  const closeAiMenu = useCallback(() => setAiMenuOpen(false), [])
  const toggleAiPanel = useCallback(() => setAiPanelCollapsed((v) => !v), [])

  // ---- 分组：把选中的多个节点打包成组，可在组层面整体管理 ----
  const groupBoundingBox = useCallback(
    (nodeIds: string[]) => {
      const picks = nodesRef.current.filter((n) => nodeIds.includes(n.id))
      if (picks.length === 0) return null
      const minX = Math.min(...picks.map((n) => n.x))
      const minY = Math.min(...picks.map((n) => n.y))
      const maxX = Math.max(...picks.map((n) => n.x + n.w))
      const maxY = Math.max(...picks.map((n) => n.y + n.h))
      return { minX, minY, maxX, maxY }
    },
    [],
  )

  const createGroup = useCallback(
    (name: string) => {
      const ids = selectedRef.current.filter((id) => nodesRef.current.some((n) => n.id === id))
      if (ids.length < 2) return
      const box = groupBoundingBox(ids)
      if (!box) return
      commitHistory()
      const id = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const group: CanvasGroup = {
        id,
        name: name.trim() || `组 ${groupsRef.current.length + 1}`,
        nodeIds: ids,
        collapsed: false,
        x: box.minX,
        y: box.minY - 34,
        w: Math.max(160, box.maxX - box.minX),
      }
      setGroups((list) => [...list, group])
      setSelectedGroupId(id)
    },
    [commitHistory, groupBoundingBox],
  )

  const toggleGroup = useCallback((id: string) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)))
    setSelectedGroupId(id)
  }, [])

  const renameGroup = useCallback(
    (id: string, name: string) => {
      setGroups((list) => list.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)))
    },
    [],
  )

  const ungroup = useCallback(
    (id: string) => {
      commitHistory()
      setGroups((list) => list.filter((g) => g.id !== id))
      setSelectedGroupId((cur) => (cur === id ? null : cur))
    },
    [commitHistory],
  )

  // 拖动组头部：整体移动组内所有节点（复用节点拖动逻辑）
  const onGroupHeaderPointerDown = useCallback(
    (e: ReactPointerEvent, group: CanvasGroup) => {
      if (e.button !== 0) return
      e.stopPropagation()
      setSelectedGroupId(group.id)
      const ids = group.nodeIds
      const startPositions: Record<string, { x: number; y: number }> = {}
      for (const n of nodesRef.current) {
        if (ids.includes(n.id)) startPositions[n.id] = { x: n.x, y: n.y }
      }
      dragRef.current = {
        mode: "node",
        startClientX: e.clientX,
        startClientY: e.clientY,
        ids,
        origins: startPositions,
        moved: false,
        snapshot: { nodes: nodesRef.current, edges: edgesRef.current },
      }
      beginWindowDrag()
    },
    [beginWindowDrag],
  )

  // 双击节点进入编辑；失焦 / Esc / 画布操作退出编辑（内容真有改动才记入历史）
  const startEdit = useCallback((id: string) => {
    editSnapRef.current = { nodes: nodesRef.current, edges: edgesRef.current }
    setSelectedIds([id])
    setEditingId(id)
  }, [])
  const endEdit = useCallback(() => {
    const id = editingIdRef.current
    if (id && editSnapRef.current) {
      const before = editSnapRef.current.nodes.find((n) => n.id === id)?.content ?? ""
      const after = nodesRef.current.find((n) => n.id === id)?.content ?? ""
      if (before !== after) pushPast(editSnapRef.current)
    }
    editSnapRef.current = null
    setEditingId(null)
  }, [pushPast])
  const updateContent = useCallback((id: string, content: string) => {
    setNodes((list) => list.map((n) => (n.id === id ? { ...n, content } : n)))
  }, [])

  /** 更新角色/场景节点的标题 */
  const updateTitle = useCallback((id: string, title: string) => {
    setNodes((list) => list.map((n) => (n.id === id ? { ...n, title } : n)))
  }, [])

  /** 更新图片节点的本地预览 URL（base64 data URL） */
  const updateImageUrl = useCallback((id: string, imageUrl: string) => {
    setNodes((list) => list.map((n) => (n.id === id ? { ...n, imageUrl } : n)))
  }, [])

  /** 删除图片节点的本地预览 URL */
  const removeImageUrl = useCallback((id: string) => {
    setNodes((list) => list.map((n) => (n.id === id ? { ...n, imageUrl: undefined } : n)))
  }, [])

  /** 角色/场景节点：上传图片到指定加号点位（覆盖原图） */
  const updateSlotImage = useCallback((id: string, slot: number, imageUrl: string) => {
    setNodes((list) =>
      list.map((n) =>
        n.id === id
          ? { ...n, slotImages: { ...(n.slotImages ?? {}), [slot]: imageUrl } }
          : n,
      ),
    )
  }, [])

  /** 角色/场景节点：移除指定加号点位的图片 */
  const removeSlotImage = useCallback((id: string, slot: number) => {
    setNodes((list) =>
      list.map((n) => {
        if (n.id !== id || !n.slotImages) return n
        const next = { ...n.slotImages }
        delete next[slot]
        return { ...n, slotImages: next }
      }),
    )
  }, [])

  // Delete / Backspace 删除选中；Esc 关菜单；Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Ctrl+C 复制全部 / Ctrl+V 粘贴
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        setAiMenuOpen(false)
        setEditingId(null)
        setContextMenu(null)
        setPortPopup(null)
        return
      }
      const target = e.target as HTMLElement | null
      const typing = Boolean(
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable),
      )
      if ((e.ctrlKey || e.metaKey) && !typing) {
        const k = e.key.toLowerCase()
        if (k === "z" && !e.shiftKey) {
          e.preventDefault()
          undo()
          return
        }
        if ((k === "z" && e.shiftKey) || k === "y") {
          e.preventDefault()
          redo()
          return
        }
        if (k === "c") {
          e.preventDefault()
          copyAllNodes()
          return
        }
        if (k === "v") {
          e.preventDefault()
          pasteNodes()
          return
        }
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (typing) return
      const edgeSel = edgeSelRef.current
      if (edgeSel) {
        e.preventDefault()
        commitHistory()
        setEdges((list) => list.filter((ed) => ed.id !== edgeSel))
        setSelectedEdgeId(null)
        return
      }
      const grpSel = groupSelRef.current
      if (grpSel) {
        e.preventDefault()
        ungroup(grpSel)
        return
      }
      const sel = selectedRef.current
      if (sel.length === 0) return
      e.preventDefault()
      commitHistory()
      setNodes((list) => list.filter((n) => !sel.includes(n.id)))
      setEdges((list) => list.filter((ed) => !sel.includes(ed.from) && !sel.includes(ed.to)))
      // 从各组中移除被删除的节点
      setGroups((list) =>
        list.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => !sel.includes(id)) })),
      )
      setSelectedIds([])
      setEditingId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, copyAllNodes, pasteNodes, commitHistory])

  // 首次进入自动把已有节点收进视口居中，小屏幕也不会裁切
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const list = nodesRef.current
    if (!rect.width || list.length === 0) return
    const minX = Math.min(...list.map((n) => n.x))
    const minY = Math.min(...list.map((n) => n.y))
    const maxX = Math.max(...list.map((n) => n.x + n.w))
    const maxY = Math.max(...list.map((n) => n.y + n.h))
    const bw = maxX - minX
    const bh = maxY - minY
    const scale = clampScale(Math.min(1, (rect.width - 140) / bw, (rect.height - 140) / bh))
    setCamera({
      x: (rect.width - bw * scale) / 2 - minX * scale,
      y: (rect.height - bh * scale) / 2 - minY * scale,
      scale,
    })
  }, [])

  // 点阵网格样式：点距与点径随缩放变化、位置随平移变化，体现无限延伸
  const gridStyle = useMemo<CSSProperties>(() => {
    const scale = camera.scale
    let step = GRID_SIZE
    while (step * scale < 12) step *= 2
    const fine = step * scale
    const coarse = fine * 5
    const dotFine = Math.min(2, Math.max(0.75, scale))
    const dotCoarse = dotFine * 1.5
    return {
      backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / 0.14) ${dotFine}px, transparent ${dotFine}px), radial-gradient(circle, hsl(var(--foreground) / 0.22) ${dotCoarse}px, transparent ${dotCoarse}px)`,
      backgroundSize: `${fine}px ${fine}px, ${coarse}px ${coarse}px`,
      backgroundPosition: `${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px`,
    }
  }, [camera])

  return {
    containerRef,
    camera,
    gridStyle,
    nodes,
    nodeMediaMap,
    selectedIds,
    marquee,
    menuOpen,
    aiMenuOpen,
    canvasMode,
    zoomPercent: Math.round(camera.scale * 100),
    nodeCount: nodes.length,
    selectedCount: selectedIds.length,
    onBackgroundPointerDown,
    onNodePointerDown,
    onPointerTrack,
    toggleMenu,
    openMenu,
    closeMenu,
    toggleAiMenu,
    openAiMenu,
    closeAiMenu,
    addAssetAtPointer,
    addNodeAtPointer,
    setCanvasMode,
    zoomIn,
    zoomOut,
    resetView,
    editingId,
    startEdit,
    endEdit,
    updateContent,
    updateTitle,
    edges,
    selectedEdgeId,
    linkDraft,
    onLinkStart,
    selectEdge,
    contextMenu,
    onBackgroundContextMenu,
    closeContextMenu,
    portPopup,
    closePortPopup,
    onPortLinkPick,
    addNodeAtWorld,
    fileInputRef,
    onUploadFiles,
    requestUploadAtWorld,
    requestUploadAtPointer,
    undo,
    redo,
    canUndo,
    canRedo,
    copyAllNodes,
    pasteNodes,
    hasClipboard,
    aiPanelCollapsed,
    toggleAiPanel,
    groups,
    selectedGroupId,
    createGroup,
    toggleGroup,
    renameGroup,
    ungroup,
    onGroupHeaderPointerDown,
    updateImageUrl,
    removeImageUrl,
    updateSlotImage,
    removeSlotImage,
    completeLinkTo,
    linkNodes,
  }
}
