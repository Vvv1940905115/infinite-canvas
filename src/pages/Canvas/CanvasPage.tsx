import { useMemo, useState } from "react"
import { FolderPlus, Settings, Users } from "lucide-react"
import { AddMenu } from "@/components/canvas/AddMenu"
import { CanvasNode } from "@/components/canvas/CanvasNode"
import { CanvasStatusBar } from "@/components/canvas/CanvasStatusBar"
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar"
import { ContextMenu } from "@/components/canvas/ContextMenu"
import { EdgesLayer } from "@/components/canvas/EdgesLayer"
import { GroupLayer } from "@/components/canvas/GroupLayer"
import { PortLinkMenu } from "@/components/canvas/PortLinkMenu"
import type { PortLinkOption } from "@/components/canvas/PortLinkMenu"
import { SelectionRect } from "@/components/canvas/SelectionRect"
import { SettingsPanel } from "@/components/canvas/SettingsPanel"
import { HistoryPanel } from "@/components/canvas/HistoryPanel"
import { HelpPanel } from "@/components/canvas/HelpPanel"
import { AssetLibraryPanel } from "@/components/canvas/AssetLibraryPanel"
import { usePaths } from "@/lib/paths"
import { useAiSettings } from "@/lib/aiSettings"
import { cn } from "@/lib/utils"
import type { NodeKind } from "@/components/canvas/nodeTypes"
import type { useCanvas } from "./useCanvas"

const INPUT_PORT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "image" as NodeKind, label: "图片" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "character" as NodeKind, label: "角色" },
  { kind: "scene" as NodeKind, label: "场景" },
]

const OUTPUT_PORT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "image" as NodeKind, label: "图片" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "audio" as NodeKind, label: "音频" },
  { kind: "quickcut" as NodeKind, label: "快速剪辑" },
]

const IMAGE_NODE_OUTPUT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "image" as NodeKind, label: "图片" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "quickcut" as NodeKind, label: "快捷剪辑" },
]

const IMAGE_NODE_INPUT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "image" as NodeKind, label: "图片" },
  { kind: "character" as NodeKind, label: "角色" },
  { kind: "scene" as NodeKind, label: "场景" },
]

const VIDEO_NODE_OUTPUT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "compose" as NodeKind, label: "视频合成" },
  { kind: "quickcut" as NodeKind, label: "快捷剪辑" },
]

const VIDEO_NODE_INPUT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "image" as NodeKind, label: "图片" },
  { kind: "audio" as NodeKind, label: "音频" },
  { kind: "character" as NodeKind, label: "角色" },
  { kind: "scene" as NodeKind, label: "场景" },
]

const AUDIO_NODE_OUTPUT_OPTIONS: PortLinkOption[] = [
  { kind: "audio" as NodeKind, label: "音频" },
  { kind: "video" as NodeKind, label: "视频" },
  { kind: "quickcut" as NodeKind, label: "快捷剪辑" },
]

const AUDIO_NODE_INPUT_OPTIONS: PortLinkOption[] = [
  { kind: "text" as NodeKind, label: "文本" },
]

export function CanvasPage(p: ReturnType<typeof useCanvas>) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { paths, update, reset } = usePaths()
  const { ai, update: updateAi, reset: resetAi } = useAiSettings()
  const [assetRefreshKey, setAssetRefreshKey] = useState(0)
  const [groupNaming, setGroupNaming] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)

  // 折叠组的成员节点：渲染时隐藏（仅显示组头）
  const hiddenNodeIds = useMemo(() => {
    const set = new Set<string>()
    for (const g of p.groups) if (g.collapsed) g.nodeIds.forEach((id) => set.add(id))
    return set
  }, [p.groups])

  const visibleNodes = useMemo(
    () => p.nodes.filter((n) => !hiddenNodeIds.has(n.id)),
    [p.nodes, hiddenNodeIds],
  )

  const submitGroup = () => {
    p.createGroup(groupName)
    setGroupName("")
    setGroupNaming(false)
  }

  return (
    <main
      ref={p.containerRef}
      onPointerMove={p.onPointerTrack}
      className="relative h-screen w-full touch-none select-none overflow-hidden bg-background font-sans text-foreground"
    >
      {/* 背景层：点阵网格跟随画布平移缩放，营造无限延伸感 */}
      <div
        onPointerDown={p.onBackgroundPointerDown}
        onContextMenu={p.onBackgroundContextMenu}
        className={
          p.canvasMode === "select" ? "absolute inset-0 cursor-crosshair" : "absolute inset-0 cursor-grab"
        }
        style={p.gridStyle}
      >
      </div>

      {/* 世界层：随相机变换的节点画布 */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-10"
        style={{
          transform: `translate(${p.camera.x}px, ${p.camera.y}px) scale(${p.camera.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <EdgesLayer
          edges={p.edges}
          nodes={p.nodes}
          selectedEdgeId={p.selectedEdgeId}
          linkDraft={p.linkDraft}
          onSelectEdge={p.selectEdge}
        />
        {visibleNodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={p.selectedIds.includes(node.id)}
            editing={p.editingId === node.id}
            panelCollapsed={p.aiPanelCollapsed}
            onPointerDown={p.onNodePointerDown}
            onDoubleClick={p.startEdit}
            onChangeContent={p.updateContent}
            onTitleChange={p.updateTitle}
            onEndEdit={p.endEdit}
            onLinkStart={p.onLinkStart}
            onLinkComplete={p.completeLinkTo}
            onTogglePanel={p.toggleAiPanel}
            onOpenAdd={p.openMenu}
            onImageUpload={p.updateImageUrl}
            onImageRemove={p.removeImageUrl}
            imageNodes={p.nodes
              .filter((n) => n.kind === "image" && n.imageUrl)
              .map((n) => ({
                id: n.id,
                imageUrl: n.imageUrl as string,
                label: n.content?.trim() || "图片",
              }))}
            onSlotUpload={p.updateSlotImage}
            onSlotRemove={p.removeSlotImage}
            onAssetSaved={() => setAssetRefreshKey((k) => k + 1)}
            assetRoot={paths.assetLibrary}
            ai={ai}
          />
        ))}

        <GroupLayer
          groups={p.groups}
          selectedGroupId={p.selectedGroupId}
          onHeaderPointerDown={p.onGroupHeaderPointerDown}
          onToggle={p.toggleGroup}
          onRename={p.renameGroup}
          onUngroup={p.ungroup}
        />
      </div>

      {p.marquee && <SelectionRect rect={p.marquee} />}

      {/* 选中多个节点时，画布上方中央出现「新建组」入口 */}
      {!groupNaming && p.selectedCount >= 2 && (
        <button
          type="button"
          onClick={() => setGroupNaming(true)}
          className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-popover/90 px-4 py-1.5 text-sm font-semibold text-foreground shadow-md backdrop-blur transition-colors hover:bg-primary/15"
        >
          <FolderPlus className="h-4 w-4 text-primary" />
          新建组（{p.selectedCount}）
        </button>
      )}

      {/* 新建组的命名浮层：自定义填写组名称 */}
      {groupNaming && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="w-[320px] rounded-2xl border border-border bg-popover p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">新建组</h3>
            </div>
            <input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitGroup()
                if (e.key === "Escape") {
                  setGroupName("")
                  setGroupNaming(false)
                }
              }}
              placeholder="请输入组名称，例如：开场镜头"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setGroupName("")
                  setGroupNaming(false)
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/15"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitGroup}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {p.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-full border border-dashed border-border bg-popover/80 px-6 py-3 text-sm text-muted-foreground shadow-md backdrop-blur">
            画布空了，点左上角的圆形 + 按钮添加第一个节点
          </div>
        </div>
      )}

      <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-border bg-popover/90 px-4 py-1.5 shadow-md backdrop-blur">
        <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold">锋少的无限画布</span>
      </div>

      <CanvasToolbar
        canvasMode={p.canvasMode}
        menuOpen={p.menuOpen}
        onToggleMenu={p.toggleMenu}
        onSetMode={p.setCanvasMode}
        onZoomIn={p.zoomIn}
        onZoomOut={p.zoomOut}
        onResetView={p.resetView}
        onOpenAssetLibrary={() => {
          setHistoryOpen(false)
          setHelpOpen(false)
          setAssetLibraryOpen((v) => !v)
        }}
        onOpenHistory={() => {
          setHelpOpen(false)
          setHistoryOpen((v) => !v)
        }}
        onOpenHelp={() => {
          setHistoryOpen(false)
          setHelpOpen((v) => !v)
        }}
      />

      {/* 右上角操作栏：左【社区】 + 右【路径设置】 */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <button
          type="button"
          aria-label="社区"
          title="社区"
          className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-popover/90 px-4 text-sm font-medium text-foreground shadow-md transition-colors hover:bg-primary/15 backdrop-blur"
        >
          <Users className="h-4 w-4" />
          社区
        </button>
        <button
          type="button"
          aria-label="路径设置"
          title="路径设置"
          onClick={() => setSettingsOpen((v) => !v)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-popover/90 shadow-md backdrop-blur transition-colors",
            settingsOpen
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <SettingsPanel
        open={settingsOpen}
        paths={paths}
        onUpdate={update}
        onReset={reset}
        ai={ai}
        onAiUpdate={updateAi}
        onAiReset={resetAi}
        onClose={() => setSettingsOpen(false)}
      />

      <HistoryPanel
        open={historyOpen}
        canUndo={p.canUndo}
        canRedo={p.canRedo}
        onUndo={p.undo}
        onRedo={p.redo}
        onClose={() => setHistoryOpen(false)}
      />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AssetLibraryPanel
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
        assetRoot={paths.assetLibrary}
        refreshKey={assetRefreshKey}
      />

      <AddMenu
        open={p.menuOpen}
        onPick={(kind) => (kind === "upload" ? p.requestUploadAtPointer() : p.addNodeAtPointer(kind))}
        onClose={p.closeMenu}
      />

      {/* 隐藏的文件选择器：右键「上传」/ 菜单「上传文件」共用 */}
      <input
        ref={p.fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={p.onUploadFiles}
      />

      {p.contextMenu && (
        <ContextMenu
          x={p.contextMenu.x}
          y={p.contextMenu.y}
          canUndo={p.canUndo}
          canRedo={p.canRedo}
          hasClipboard={p.hasClipboard}
          onUpload={() => p.requestUploadAtWorld(p.contextMenu!.worldX, p.contextMenu!.worldY)}
          onAddKind={(kind) => p.addNodeAtWorld(kind, p.contextMenu!.worldX, p.contextMenu!.worldY)}
          onUndo={() => {
            p.undo()
            p.closeContextMenu()
          }}
          onRedo={() => {
            p.redo()
            p.closeContextMenu()
          }}
          onCopyAll={() => {
            p.copyAllNodes()
            p.closeContextMenu()
          }}
          onPaste={() => {
            p.pasteNodes()
            p.closeContextMenu()
          }}
          onClose={p.closeContextMenu}
        />
      )}

      {p.portPopup && (
        <PortLinkMenu
          open={true}
          title={p.portPopup.direction === "left" ? "添加上游输入" : "引用该节点生成"}
          options={
            (() => {
              const node = p.nodes.find((n) => n.id === p.portPopup?.nodeId)
              if (node?.kind === "image") {
                return p.portPopup.direction === "left"
                  ? IMAGE_NODE_INPUT_OPTIONS
                  : IMAGE_NODE_OUTPUT_OPTIONS
              }
              if (node?.kind === "video") {
                return p.portPopup.direction === "left"
                  ? VIDEO_NODE_INPUT_OPTIONS
                  : VIDEO_NODE_OUTPUT_OPTIONS
              }
              if (node?.kind === "audio") {
                return p.portPopup.direction === "left"
                  ? AUDIO_NODE_INPUT_OPTIONS
                  : AUDIO_NODE_OUTPUT_OPTIONS
              }
              return p.portPopup.direction === "left"
                ? INPUT_PORT_OPTIONS
                : OUTPUT_PORT_OPTIONS
            })()
          }
          x={p.portPopup.direction === "left" ? p.portPopup.screenX - 208 : p.portPopup.screenX}
          y={p.portPopup.screenY}
          onPick={p.onPortLinkPick}
          onClose={p.closePortPopup}
        />
      )}

      <CanvasStatusBar
        zoomPercent={p.zoomPercent}
        nodeCount={p.nodeCount}
        selectedCount={p.selectedCount}
        canvasMode={p.canvasMode}
      />
    </main>
  )
}
