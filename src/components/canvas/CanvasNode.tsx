import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  ArrowUp,
  AudioLines,
  ChevronDown,
  ChevronUp,
  Mic,
  Music,
  Plus,
  Replace,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CanvasNodeItem } from "@/pages/Canvas/useCanvas"
import type { NodeKind } from "./nodeTypes"
import { NODE_META } from "./nodeTypes"
import {
  AUDIO_MODELS,
  AUDIO_VOICES,
  getModelById,
  getModelId,
  modelsForKind,
  PROVIDER_LABEL,
} from "@/lib/aiModels"
import type { AiSettings } from "@/lib/aiSettings"
import { generateImage, generateSpeech, pollVideoTask, submitVideoTask } from "@/lib/aiClient"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function PlusGridMenu({
  imageNodes,
  slotImages,
  onSlotUpload,
  onSlotRemove,
}: {
  imageNodes?: { id: string; imageUrl: string; label: string }[]
  slotImages?: Record<number, string>
  onSlotUpload?: (slot: number, dataUrl: string) => void
  onSlotRemove?: (slot: number) => void
}) {
  const [openSlot, setOpenSlot] = useState<number | null>(null)
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)
  const fileInputSlot = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const slot = fileInputSlot.current
    if (!file || slot === null || !onSlotUpload) {
      e.target.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onSlotUpload(slot, reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
    setOpenSlot(null)
    fileInputSlot.current = null
  }

  const pickLocal = (slot: number) => {
    fileInputSlot.current = slot
    fileInputRef.current?.click()
    setOpenSlot(null)
  }

  const pickFromCanvas = (slot: number) => {
    setOpenSlot(null)
    setPickingSlot(slot)
  }

  const chooseCanvasImage = (_targetNodeId: string, imageUrl: string) => {
    if (pickingSlot !== null) onSlotUpload?.(pickingSlot, imageUrl)
    setPickingSlot(null)
  }

  return (
    <div className="grid grid-cols-4 grid-rows-2 gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => {
        const img = slotImages?.[i]

  return (
          <div key={i} className="relative">
            {img ? (
              <div
                className="group relative aspect-square w-full overflow-hidden rounded-md border border-border bg-card"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenSlot(openSlot === i ? null : i)
                }}
              >
                <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-0 top-0 rounded-br-md bg-yellow-500 px-1 py-0 text-[8px] font-bold leading-none text-black">
                    主图
                  </span>
                )}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSlotRemove?.(i)
                  }}
                  className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] leading-none text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenSlot(openSlot === i ? null : i)
                }}
                className="flex aspect-square w-full items-center justify-center rounded-md border border-border bg-card transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {openSlot === i && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onPointerDown={() => setOpenSlot(null)}
                  aria-hidden="true"
                />
                <div className="absolute left-1/2 top-full z-50 mt-1 w-28 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      pickLocal(i)
                    }}
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                  >
                    本地上传
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      pickFromCanvas(i)
                    }}
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                  >
                    从画布选图
                  </button>
                  {img && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSlotRemove?.(i)
                        setOpenSlot(null)
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-primary/15"
                    >
                      移除图片
                    </button>
                  )}
                </div>
              </>
            )}
            {pickingSlot === i && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onPointerDown={() => setPickingSlot(null)}
                  aria-hidden="true"
                />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-40 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-2xl">
                  {imageNodes && imageNodes.length > 0 ? (
                    imageNodes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          chooseCanvasImage(n.id, n.imageUrl)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                      >
                        <img
                          src={n.imageUrl}
                          alt={n.label}
                          className="h-7 w-7 shrink-0 rounded object-cover"
                        />
                        <span className="truncate">{n.label}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      画布上暂无图片节点
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

const CATEGORY_EXT: Record<string, string> = {
  图片: ".png",
  视频: ".mp4",
  音频: ".mp3",
}

async function saveAsset(category: string, dataUrl: string, root: string, name?: string) {
  const res = await fetch("/api/save-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category,
      dataUrl,
      root,
      filename: name || `ai-gen-${Date.now()}${CATEGORY_EXT[category] || ".png"}`,
    }),
  })
  const data = (await res.json()) as { ok?: boolean; path?: string; error?: string; category?: string; name?: string }
  if (!res.ok || !data.ok) throw new Error(data.error || "保存失败")
  return data
}

interface CanvasNodeProps {
  node: CanvasNodeItem
  selected: boolean
  editing: boolean
  panelCollapsed: boolean
  onPointerDown: (e: ReactPointerEvent, node: CanvasNodeItem) => void
  onDoubleClick: (id: string) => void
  onChangeContent: (id: string, content: string) => void
  /** 更新角色/场景节点的标题 */
  onTitleChange?: (id: string, title: string) => void
  onEndEdit: () => void
  onLinkStart: (e: ReactPointerEvent, node: CanvasNodeItem, direction: "left" | "right") => void
  /** 连线拖拽到本节点锚点上松开时完成连线 */
  onLinkComplete?: (targetNodeId: string, targetSide: "left" | "right") => boolean
  onTogglePanel: () => void
  onOpenAdd: () => void
  onImageUpload?: (id: string, dataUrl: string) => void
  onImageRemove?: (id: string) => void
  /** 下游节点通过连线接收的上游媒体列表（仅在下方 AI 面板显示预览，不替换节点本体） */
  connectedMedia?: { url: string; kind: NodeKind }[]
  imageNodes?: { id: string; imageUrl: string; label: string }[]
  onSlotUpload?: (id: string, slot: number, dataUrl: string) => void
  onSlotRemove?: (id: string, slot: number) => void
  onAssetSaved?: (category: string, name: string, path: string) => void
  assetRoot?: string
  /** AI 模型设置（由 CanvasPage 统一持有，保证设置面板改动实时生效） */
  ai: AiSettings
}

export function CanvasNode({
  node,
  selected,
  editing,
  panelCollapsed,
  onPointerDown,
  onDoubleClick,
  onChangeContent,
  onTitleChange,
  onEndEdit,
  onLinkStart,
  onLinkComplete,
  onTogglePanel,
  onOpenAdd,
  onImageUpload,
  onImageRemove,
  connectedMedia,
  imageNodes,
  onSlotUpload,
  onSlotRemove,
  onAssetSaved,
  assetRoot,
  ai,
}: CanvasNodeProps) {
  const meta = NODE_META[node.kind]
  const Icon = meta.icon
  const hasContent = Boolean(node.content && node.content.trim())
  const isMedia = node.kind === "image" || node.kind === "video" || node.kind === "audio"
  const mediaLabel = node.kind === "video" ? "视频" : node.kind === "audio" ? "音频" : "图片"
  const hasMedia = Boolean(node.imageUrl)
  // 媒体 URL：仅本地手动上传/生成；连线传入的媒体只在下方 AI 面板显示预览（connectedMedia），不替换节点本体
  const mediaUrl = node.imageUrl
  const hasDisplayMedia = Boolean(mediaUrl)
  // 角色/场景节点：连线传入的第一个媒体回退展示为主图（slot 0），本地手动上传优先
  const isCharacterScene = node.kind === "character" || node.kind === "scene"
  const slotImagesForDisplay =
    isCharacterScene && connectedMedia?.length && !node.slotImages?.[0]
      ? { ...(node.slotImages ?? {}), 0: connectedMedia[0].url }
      : node.slotImages
  const [prompt, setPrompt] = useState("")
  // 根据节点类型自动决定保存分类：图片/视频/音频节点一一对应，其余默认图片
  const assetCategory = node.kind === "video" ? "视频" : node.kind === "audio" ? "音频" : "图片"
  const [generating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 模型选择：视频节点 → Seedance；图片/其他 → Gemini/OpenAI
  const isVideoNode = node.kind === "video"
  const modelOptions = modelsForKind(isVideoNode ? "video" : "image")
  const [modelKey, setModelKey] = useState(() => modelOptions[0].id)
  const model = getModelById(modelKey) ?? modelOptions[0]

  // 音频节点：文字转语音 / 音乐生成（MiniMax）
  const [audioTask, setAudioTask] = useState<"tts" | "music">("tts")
  const audioTaskModels = AUDIO_MODELS.filter((m) => m.task === audioTask)
  const [audioModelKey, setAudioModelKey] = useState(() => AUDIO_MODELS[0].id)
  const audioModel = audioTaskModels.find((m) => m.id === audioModelKey) ?? audioTaskModels[0]
  const [voiceKey, setVoiceKey] = useState(() => AUDIO_VOICES[0].id)

  /** 触发文件选择（替换图片共用入口） */
  const pickFile = () => fileInputRef.current?.click()

  const stop = (e: { stopPropagation(): void }) => {
    e.stopPropagation()
  }

  /** 处理文件选择 → 读取为 base64 data URL 回传 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onImageUpload) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onImageUpload(node.id, dataUrl)
    }
    reader.readAsDataURL(file)
    // 重置 input 以允许重复选同一文件
    e.target.value = ""
  }

  const [titleEditing, setTitleEditing] = useState(false)

  return (
    <div
      onPointerDown={(e) => {
        if (editing) {
          e.stopPropagation()
          return
        }
        onPointerDown(e, node)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick(node.id)
      }}
      className="group pointer-events-auto absolute cursor-move"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {/* 类型标签：卡片上方 */}
      <div className="absolute -top-6 left-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{meta.label}</span>
      </div>

      {/* 节点卡片本体 */}
      <div
        className={cn(
          "h-full w-full rounded-2xl border bg-card/90 p-3.5 shadow-lg transition-[border-color,box-shadow] duration-150",
          selected ? "border-foreground/50 shadow-xl" : "border-border hover:border-foreground/30",
        )}
      >
        {/* 媒体节点（图片 / 视频）：空节点顶部居中【上传】；有媒体后右上角【替换/删除】+ 底部【替换】 */}
        {isMedia && (
          <>
            {!hasDisplayMedia && (
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
                <button
                  type="button"
                  onClick={pickFile}
                  onPointerDown={stop}
                  className="flex items-center gap-1.5 rounded-b-xl border border-border bg-popover/95 px-3 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-primary/15"
                >
                  <Upload className="h-3.5 w-3.5" />
                  上传{mediaLabel}
                </button>
              </div>
            )}

            {hasMedia && (
              <>
                {/* 右上角：替换 / 删除 */}
                <div className="absolute right-1 top-1 z-20 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`替换${mediaLabel}`}
                    title={`替换${mediaLabel}`}
                    onClick={pickFile}
                    onPointerDown={stop}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-popover/90 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-primary/15 hover:text-foreground"
                  >
                    <Replace className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除${mediaLabel}`}
                    title={`删除${mediaLabel}`}
                    onClick={() => onImageRemove?.(node.id)}
                    onPointerDown={stop}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-popover/90 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 底部：双入口替换 */}
                <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center">
                  <button
                    type="button"
                    onClick={pickFile}
                    onPointerDown={stop}
                    className="mb-2 flex items-center gap-1.5 rounded-full border border-border bg-popover/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-primary/15"
                  >
                    <Replace className="h-3.5 w-3.5" />
                    替换{mediaLabel}
                  </button>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}

        {node.kind === "character" || node.kind === "scene" ? (
          <div className="flex h-full w-full flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              {titleEditing && onTitleChange ? (
                <input
                  autoFocus
                  defaultValue={node.title ?? ""}
                  placeholder={node.kind === "character" ? "未命名角色" : "未命名场景"}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (node.title ?? "")) onTitleChange(node.id, v)
                    setTitleEditing(false)
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") { setTitleEditing(false); e.preventDefault() }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
                />
              ) : (
                <span
                  className="px-1 py-0.5 text-sm font-medium text-foreground cursor-text select-none hover:bg-foreground/5 rounded"
                  title="点击修改名称"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onTitleChange) setTitleEditing(true)
                  }}
                >
                  {node.title || (node.kind === "character" ? "未命名角色" : "未命名场景")}
                </span>
              )}
              {slotImagesForDisplay?.[0] && (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                  <img
                    src={slotImagesForDisplay[0]}
                    alt="主图"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
            <textarea
              value={node.content ?? ""}
              placeholder={
                node.kind === "character" ? "外貌、性格、背景…" : "环境、氛围、时段…"
              }
              onChange={(e) => onChangeContent(node.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="min-h-0 flex-1 cursor-text resize-none rounded-lg border border-border bg-card/50 p-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
            <PlusGridMenu
              imageNodes={imageNodes}
              slotImages={slotImagesForDisplay}
              onSlotUpload={(slot, url) => onSlotUpload?.(node.id, slot, url)}
              onSlotRemove={(slot) => onSlotRemove?.(node.id, slot)}
            />
          </div>
        ) : hasDisplayMedia ? (
          node.kind === "video" ? (
            <video
              src={mediaUrl}
              controls
              playsInline
              className="h-full w-full rounded-xl border border-border/60 bg-black object-contain"
            />
          ) : node.kind === "audio" ? (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-border/60 bg-card p-2">
              <audio src={mediaUrl} controls className="w-full" />
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={meta.label}
              draggable={false}
              className="h-full w-full rounded-xl border border-border/60 object-cover"
            />
          )
        ) : editing ? (
          <textarea
            autoFocus
            value={node.content ?? ""}
            placeholder="双击开始编辑…"
            onChange={(e) => onChangeContent(node.id, e.target.value)}
            onBlur={onEndEdit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Escape") {
                e.preventDefault()
                onEndEdit()
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-full w-full cursor-text resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        ) : hasContent ? (
          <p className="h-full overflow-hidden whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {node.content}
          </p>
        ) : (
          <span className="text-sm text-muted-foreground">双击开始编辑…</span>
        )}
      </div>

      {/* 左右圆形加号连接点：仅选中时显示 */}
      <button
        type="button"
        aria-label="添加上游输入"
        title="添加上游输入"
        onPointerDown={(e) => onLinkStart(e, node, "left")}
        onPointerUp={(e) => {
          e.stopPropagation()
          onLinkComplete?.(node.id, "left")
        }}
        className={cn(
          "absolute -left-8 top-1/2 z-30 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/40 bg-background/80 text-foreground/70 transition-opacity hover:border-primary hover:text-primary",
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="引用该节点生成"
        title="引用该节点生成"
        onPointerDown={(e) => onLinkStart(e, node, "right")}
        onPointerUp={(e) => {
          e.stopPropagation()
          onLinkComplete?.(node.id, "right")
        }}
        className={cn(
          "absolute -right-8 top-1/2 z-30 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/40 bg-background/80 text-foreground/70 transition-opacity hover:border-primary hover:text-primary",
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* 音频节点：文字转语音 / 音乐生成面板（MiniMax），选中时出现在节点下方 */}
      {selected && node.kind === "audio" &&
        (panelCollapsed ? (
          <button
            type="button"
            onPointerDown={stop}
            onDoubleClick={stop}
            onClick={onTogglePanel}
            className="absolute left-1/2 top-full mt-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg"
          >
            <AudioLines className="h-3.5 w-3.5 text-primary" />
            {audioTask === "music" ? "音乐" : "文字转语音"}
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <div
            className="absolute left-1/2 top-full z-20 mt-4 w-[480px] -translate-x-1/2 rounded-2xl border border-border bg-popover p-3 shadow-2xl"
            onPointerDown={stop}
            onDoubleClick={stop}
          >
            <div className="flex items-start justify-end">
              <button
                type="button"
                aria-label="收起面板"
                title="收起面板"
                onClick={onTogglePanel}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {/* 连线传入的媒体预览（音频节点同样显示） */}
            {connectedMedia && connectedMedia.length > 0 && (
              <div className="mb-1 flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
                {connectedMedia.map((m, i) => {
                  const kindLabel = m.kind === "video" ? "视频" : m.kind === "audio" ? "音频" : "图片"
                  const index = connectedMedia.slice(0, i + 1).filter((x) => x.kind === m.kind).length
                  return (
                    <div key={`${m.url}-${i}`} className="flex w-11 flex-col items-center gap-0.5">
                      {m.kind === "audio" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <AudioLines className="h-4 w-4" />
                        </div>
                      ) : m.kind === "video" ? (
                        <video
                          src={m.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-10 w-10 rounded-lg bg-black object-cover ring-1 ring-border"
                        />
                      ) : (
                        <img
                          src={m.url}
                          alt="连线传入媒体"
                          draggable={false}
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                        />
                      )}
                      <span className="text-[10px] leading-none text-muted-foreground">
                        {kindLabel} {index}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <textarea
              value={prompt}
              placeholder={
                audioTask === "music" ? "描述你想要的音乐风格或输入歌词" : "输入你想转换成语音的文本内容"
              }
              rows={3}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="mt-1 w-full cursor-text resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* 任务类型：文字转语音 / 音乐 */}
              <Select
                value={audioTask}
                onValueChange={(v) => {
                  const next = v as "tts" | "music"
                  setAudioTask(next)
                  const first = AUDIO_MODELS.find((m) => m.task === next)
                  if (first) setAudioModelKey(first.id)
                }}
              >
                <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="选择生成任务">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tts">
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Mic className="h-3.5 w-3.5" />
                        文字转语音
                      </span>
                      <span className="text-[10px] text-muted-foreground">将文本转换为语音</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="music">
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Music className="h-3.5 w-3.5" />
                        音乐
                      </span>
                      <span className="text-[10px] text-muted-foreground">按描述生成音乐</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {/* 模型：跟随任务类型 */}
              <Select value={audioModel?.id ?? ""} onValueChange={setAudioModelKey}>
                <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audioTaskModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 音色：仅文字转语音 */}
              {audioTask === "tts" && (
                <Select value={voiceKey} onValueChange={setVoiceKey}>
                  <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="选择音色">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIO_VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span className="ml-auto text-xs text-muted-foreground">保存到：音频</span>
              <button
                type="button"
                aria-label="生成"
                title="生成"
                disabled={generating || !prompt.trim()}
                onClick={async () => {
                  const text = prompt.trim()
                  if (!text || !audioModel) return
                  const apiKey = ai.apiKeys.minimax?.trim()
                  if (!apiKey) {
                    toast.error("请先在设置中填写 MiniMax API Key")
                    return
                  }
                  const groupId = ai.apiKeys.minimaxGroup?.trim()
                  if (!groupId) {
                    toast.error("请先在设置中填写 MiniMax GroupId")
                    return
                  }
                  setGenerating(true)
                  try {
                    onChangeContent(node.id, text)
                    const { dataUrl } = await generateSpeech({
                      model: getModelId(audioModel, ai.modelIds),
                      task: audioTask,
                      text,
                      voice: voiceKey,
                      apiKey,
                      groupId,
                    })
                    const saved = await saveAsset("音频", dataUrl, assetRoot || "")
                    onImageUpload?.(node.id, saved.path!)
                    onAssetSaved?.(saved.category!, saved.name!, saved.path!)
                    toast.success(audioTask === "music" ? "音乐已生成并保存" : "语音已生成并保存")
                    setPrompt("")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "生成失败")
                  } finally {
                    setGenerating(false)
                  }
                }}
                className="flex h-8 items-center gap-1 rounded-full bg-primary/90 px-3.5 text-xs font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? "生成中…" : "生成"}
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

      {/* AI 输入面板：选中时出现在节点下方；媒体节点上传后隐藏，空媒体节点仍显示；角色/场景节点不显示（音频节点用上方专用面板） */}
      {selected && !(node.kind === "character" || node.kind === "scene" || node.kind === "audio") &&
        !(isMedia && hasDisplayMedia) &&
        (panelCollapsed ? (
          <button
            type="button"
            onPointerDown={stop}
            onDoubleClick={stop}
            onClick={onTogglePanel}
            className="absolute left-1/2 top-full mt-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {model?.label ?? "AI 生成"}
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <div
            className="absolute left-1/2 top-full z-20 mt-4 w-[380px] -translate-x-1/2 rounded-2xl border border-border bg-popover p-3 shadow-2xl"
            onPointerDown={stop}
            onDoubleClick={stop}
          >
            <div className="flex items-start justify-between">
              <button
                type="button"
                aria-label="添加节点或资源"
                title="添加节点或资源"
                onClick={onOpenAdd}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-foreground shadow-md transition-colors hover:bg-primary/15"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="收起面板"
                title="收起面板"
                onClick={onTogglePanel}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {/* 连线传入的媒体预览：多个上游媒体节点连线到本节点时逐条显示（图片缩略图 / 视频首帧 / 音频图标） */}
            {connectedMedia && connectedMedia.length > 0 && (
              <div className="mt-1 flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
                {connectedMedia.map((m, i) => {
                  const kindLabel = m.kind === "video" ? "视频" : m.kind === "audio" ? "音频" : "图片"
                  const index = connectedMedia.slice(0, i + 1).filter((x) => x.kind === m.kind).length
                  return (
                    <div key={`${m.url}-${i}`} className="flex w-11 flex-col items-center gap-0.5">
                      {m.kind === "audio" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <AudioLines className="h-4 w-4" />
                        </div>
                      ) : m.kind === "video" ? (
                        <video
                          src={m.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-10 w-10 rounded-lg bg-black object-cover ring-1 ring-border"
                        />
                      ) : (
                        <img
                          src={m.url}
                          alt="连线传入媒体"
                          draggable={false}
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                        />
                      )}
                      <span className="text-[10px] leading-none text-muted-foreground">
                        {kindLabel} {index}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <textarea
              value={prompt}
              placeholder="描述任何你想要生成的内容"
              rows={3}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="mt-1 w-full cursor-text resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <Select value={modelKey} onValueChange={setModelKey}>
                <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">保存到：{assetCategory}</span>
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 text-muted-foreground">
              <button
                type="button"
                aria-label="语音输入"
                title="语音输入"
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                <Mic className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium">1×</span>
              <button
                type="button"
                aria-label="生成"
                title="生成"
                disabled={generating || !prompt.trim()}
                onClick={async () => {
                  const text = prompt.trim()
                  if (!text || !model) return
                  const apiKey = ai.apiKeys[model.provider]?.trim()
                  if (!apiKey) {
                    toast.error(`请先在设置中填写 ${PROVIDER_LABEL[model.provider]} API Key`)
                    return
                  }
                  setGenerating(true)
                  try {
                    onChangeContent(node.id, text)
                    const upstreamModel = getModelId(model, ai.modelIds)
                    if (model.kind === "image") {
                      const { dataUrl } = await generateImage({
                        provider: model.provider,
                        model: upstreamModel,
                        prompt: text,
                        apiKey,
                      })
                      const saved = await saveAsset("图片", dataUrl, assetRoot || "")
                      onImageUpload?.(node.id, saved.path!)
                      onAssetSaved?.(saved.category!, saved.name!, saved.path!)
                      toast.success("图片已生成并保存")
                    } else {
                      const { taskId } = await submitVideoTask({
                        model: upstreamModel,
                        prompt: text,
                        apiKey,
                        base: ai.baseUrl,
                      })
                      const done = await pollVideoTask(taskId, apiKey, ai.baseUrl)
                      onImageUpload?.(node.id, done.path)
                      onAssetSaved?.(done.category, done.name, done.path)
                      toast.success("视频已生成并保存")
                    }
                    setPrompt("")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "生成失败")
                  } finally {
                    setGenerating(false)
                  }
                }}
                className="flex h-7 items-center gap-1 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-transform hover:scale-105 disabled:opacity-50"
              >
                {generating
                  ? model?.kind === "video"
                    ? "生成中…（可能需几分钟）"
                    : "生成中…"
                  : "生成"}
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
    </div>
  )
}
