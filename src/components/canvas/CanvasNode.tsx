import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
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
  Type,
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
  groupModelsByProvider,
  modelsForKind,
  PROVIDER_LABEL,
  TEXT_MODELS,
} from "@/lib/aiModels"
import type { AiSettings } from "@/lib/aiSettings"
import { generateImage, generateSpeech, generateText, pollVideoTask, submitVideoTask } from "@/lib/aiClient"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function isVideoUrl(url: string): boolean {
  if (/^data:video\//i.test(url)) return true
  return /\.(mp4|webm|mov|mkv|avi|m4v|flv)(\?.*)?$/i.test(url)
}

/** 视频节点不同模式下，追加输入按钮的文案 */
function inputMediaLabelFor(
  kind: NodeKind,
  inputKinds: ("image" | "video")[],
  fallback: string,
): string {
  if (kind !== "video") return fallback
  const hasImage = inputKinds.includes("image")
  const hasVideo = inputKinds.includes("video")
  if (hasImage && hasVideo) return "素材"
  if (hasImage) return "图片"
  return "视频"
}

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

/** 图片画面比例：仅这 5 个 */
const ASPECT_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "1:1", w: 1024, h: 1024 },
  { id: "3:4", label: "3:4", w: 864, h: 1152 },
  { id: "4:3", label: "4:3", w: 1152, h: 864 },
  { id: "9:16", label: "9:16", w: 720, h: 1280 },
  { id: "16:9", label: "16:9", w: 1280, h: 720 },
]

/** 视频节点画面比例预设 */
const VIDEO_ASPECT_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "16:9", label: "16:9", w: 1280, h: 720 },
  { id: "4:3", label: "4:3", w: 1152, h: 864 },
  { id: "1:1", label: "1:1", w: 1024, h: 1024 },
  { id: "3:4", label: "3:4", w: 864, h: 1152 },
  { id: "9:16", label: "9:16", w: 720, h: 1280 },
]

/** 视频分辨率档位 */
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"]

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
  onImageUpload?: (id: string, dataUrl: string) => void
  onImageRemove?: (id: string) => void
  /** 根据媒体原始比例调整节点宽高（图片 onLoad / 视频 onLoadedMetadata 时调用） */
  onResize?: (id: string, w: number, h: number) => void
  /** 下游节点通过连线接收的上游媒体列表（仅在下方 AI 面板显示预览，不替换节点本体） */
  connectedMedia?: { url: string; kind: NodeKind }[]
  imageNodes?: { id: string; imageUrl: string; label: string }[]
  /** 画布上的视频节点（供下游视频节点「从画布选择」追加输入） */
  videoNodes?: { id: string; imageUrl: string; label: string }[]
  /** 画布上的音频节点（供下游音频节点「从画布选择」追加输入） */
  audioNodes?: { id: string; imageUrl: string; label: string }[]
  /** 在两个节点间自动建立连线（「从画布选择」时调用） */
  onLinkNodes?: (fromId: string, toId: string) => void
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
  onImageUpload,
  onImageRemove,
  onResize,
  connectedMedia,
  imageNodes,
  videoNodes,
  audioNodes,
  onLinkNodes,
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

  // 图片/视频加载完成后，按媒体原始宽高比自动调整节点尺寸，
  // 保证容器比例 = 媒体比例，从而使用 object-cover 也能完整呈现原比例内容
  const fitNodeToMedia = (mediaW: number, mediaH: number) => {
    if (!mediaW || !mediaH) return
    const ratio = mediaH / mediaW
    const MIN_W = 200
    const MAX_W = 560
    const MIN_H = 120
    const MAX_H = 440
    let newW = Math.min(MAX_W, Math.max(MIN_W, node.w))
    let newH = Math.round(newW * ratio)
    if (newH > MAX_H) {
      newH = MAX_H
      newW = Math.max(MIN_W, Math.round(newH / ratio))
    } else if (newH < MIN_H) {
      newH = MIN_H
      newW = Math.min(MAX_W, Math.round(newH / ratio))
    }
    if (newW !== node.w || newH !== node.h) onResize?.(node.id, newW, newH)
  }

  const [prompt, setPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [topMenuOpen, setTopMenuOpen] = useState(false)
  const [pickingTop, setPickingTop] = useState(false)

  // 模型选择：视频节点 → Seedance；文本节点 → 文本模型；图片/其他 → Gemini/OpenAI
  const isVideoNode = node.kind === "video"
  const isTextNode = node.kind === "text"
  const modelOptions = modelsForKind(isVideoNode ? "video" : isTextNode ? "text" : "image")
  const [modelKey, setModelKey] = useState(() => modelOptions[0].id)
  const model = getModelById(modelKey) ?? modelOptions[0]

  // 画面比例：仅图片 / 视频生成节点显示（已有上传素材的节点面板本身隐藏，故不生效）
  const showRatio = (node.kind === "image" || node.kind === "video") && !hasDisplayMedia
  const isImageKind = node.kind === "image"
  const ratioPresets = node.kind === "video" ? VIDEO_ASPECT_PRESETS : ASPECT_PRESETS
  const [ratioKey, setRatioKey] = useState(isImageKind ? "1:1" : "16:9")
  const [ratioOpen, setRatioOpen] = useState(false)
  const [customW, setCustomW] = useState("1280")
  const [customH, setCustomH] = useState("720")
  const isCustomRatio = ratioKey === "custom"
  const preset = ratioPresets.find((r) => r.id === ratioKey)
  const outW = isCustomRatio ? Number(customW) || 0 : (preset?.w ?? 0)
  const outH = isCustomRatio ? Number(customH) || 0 : (preset?.h ?? 0)
  // 自定义宽高时不传比例，交由服务端按数值推导；自适应直接传 adaptive
  const ratioValue = isCustomRatio ? undefined : ratioKey
  const ratioLabel = isCustomRatio ? "自定义" : ratioKey === "adaptive" ? "自适应" : ratioKey
  // 图片附加设置：图像质量 / 分辨率
  const [imgQuality, setImgQuality] = useState<"low" | "medium" | "high">("medium")
  const [imgRes, setImgRes] = useState<"1k" | "2k" | "4k">("1k")
  // 视频节点附加设置：分辨率 / 生成时长 / 是否生成音频 / 生成模式
  const [vidResolution, setVidResolution] = useState("720p")
  const [vidDuration, setVidDuration] = useState(5)
  const [vidAudio, setVidAudio] = useState(true)
  type VideoMode = "reference" | "edit" | "text2video" | "firstFrame" | "firstLastFrame" | "extend"
  const [videoMode, setVideoMode] = useState<VideoMode>("text2video")
  const VIDEO_MODE_LABELS: Record<VideoMode, string> = {
    reference: "全能参考",
    edit: "视频编辑",
    text2video: "文生视频",
    firstFrame: "首帧",
    firstLastFrame: "首尾帧",
    extend: "视频延长",
  }
  const VIDEO_MODE_HINTS: Record<VideoMode, string> = {
    reference: "需 ≥3 张图片，或图片+视频混合输入",
    edit: "需先接入视频素材（可搭配图片参考）",
    text2video: "仅支持纯提示词生成，请断开图片/视频输入",
    firstFrame: "需至少接入 1 张图片（不可接入视频）",
    firstLastFrame: "需恰好接入 2 张图片（不可接入视频）",
    extend: "需先接入视频素材",
  }
  const VIDEO_MODE_ORDER: VideoMode[] = ["reference", "edit", "text2video", "firstFrame", "firstLastFrame", "extend"]
  type VideoInputKind = "image" | "video"
  interface VideoModeConfig {
    allowsInputs: boolean
    inputKinds: VideoInputKind[]
    slotLabels: string[]
    extendButton?: boolean
  }
  const VIDEO_MODE_CONFIG: Record<VideoMode, VideoModeConfig> = {
    reference: { allowsInputs: true, inputKinds: ["image", "video"], slotLabels: ["参考图1", "参考图2"] },
    edit: { allowsInputs: true, inputKinds: ["image", "video"], slotLabels: ["图片1", "视频1"] },
    text2video: { allowsInputs: false, inputKinds: [], slotLabels: [] },
    firstFrame: { allowsInputs: true, inputKinds: ["image"], slotLabels: ["图片1", "图片2"] },
    firstLastFrame: { allowsInputs: true, inputKinds: ["image"], slotLabels: ["首帧", "尾帧"] },
    extend: { allowsInputs: true, inputKinds: ["video"], slotLabels: ["视频1"], extendButton: true },
  }
  // 输入素材统计：连线接入 + 面板内手动追加（slotImages）。
  // 图片类素材：视频 / 音频以外的带图节点（图片、角色、场景、3D、分镜等）统一按「图片输入」计入
  const slotInputUrls = Object.values(node.slotImages ?? {})
  const videoImgCount =
    (connectedMedia ?? []).filter((m) => m.kind !== "video" && m.kind !== "audio").length +
    slotInputUrls.filter((url) => !isVideoUrl(url)).length
  const videoVidCount =
    (connectedMedia ?? []).filter((m) => m.kind === "video").length +
    slotInputUrls.filter((url) => isVideoUrl(url)).length

  /** 各视频 Tab 的可用条件（输入变化时实时重算） */
  const isVideoModeEligible = (mode: VideoMode): boolean => {
    const imgs = videoImgCount
    const vids = videoVidCount
    switch (mode) {
      case "text2video":
        return imgs === 0 && vids === 0
      case "firstFrame":
        return imgs >= 1 && vids === 0
      case "firstLastFrame":
        return imgs === 2 && vids === 0
      case "extend":
        return vids >= 1
      case "edit":
        return vids >= 1
      case "reference":
        return imgs >= 3 || (imgs >= 1 && vids >= 1)
    }
  }

  /** 素材匹配度最高的自动选中目标 */
  const pickBestVideoMode = (): VideoMode => {
    const imgs = videoImgCount
    const vids = videoVidCount
    if (imgs === 0 && vids === 0) return "text2video"
    if (vids === 0) {
      if (imgs === 2) return "firstLastFrame"
      if (imgs >= 3) return "reference"
      return "firstFrame"
    }
    // 有视频输入：图片+视频混合命中「全能参考」，纯视频才命中「视频编辑」
    if (imgs >= 1) return "reference"
    return "edit"
  }
  // 手动点选标记：一旦用户手动选择了可用 Tab，不再自动切换
  const [manualVideoPicked, setManualVideoPicked] = useState(false)
  // 若当前选中 Tab 失效，渲染时立即回落为匹配度最高的可用 Tab
  const activeVideoMode = isVideoModeEligible(videoMode) ? videoMode : pickBestVideoMode()
  // 输入素材变化时：若当前 Tab 不可用，或从未手动选择且不是最优，则自动切换为最优可用 Tab
  useEffect(() => {
    // 该同步更新仅由「接入素材变化」触发，属于受控的状态同步
    /* eslint-disable react-hooks/set-state-in-effect */
    const best = pickBestVideoMode()
    if (!isVideoModeEligible(videoMode) || (!manualVideoPicked && videoMode !== best)) {
      setVideoMode(best)
      setManualVideoPicked(false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // 仅当输入素材变化时才重新评估自动切换目标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoImgCount, videoVidCount])
  const selectVideoMode = (mode: VideoMode) => {
    setManualVideoPicked(true)
    setVideoMode(mode)
  }

  const currentModeConfig = VIDEO_MODE_CONFIG[activeVideoMode]
  const getSlotLabel = (index: number) => currentModeConfig.slotLabels[index] ?? `素材${index + 1}`
  // Seedance 2.5 最大 30 秒，2.0 最大 15 秒
  const maxVidDuration = model.id === "seedance-2.5" ? 30 : 15

  // 音频节点：文字转语音 / 音乐生成（MiniMax）
  const [audioTask, setAudioTask] = useState<"tts" | "music">("tts")
  const audioTaskModels = AUDIO_MODELS.filter((m) => m.task === audioTask)
  const [audioModelKey, setAudioModelKey] = useState(() => AUDIO_MODELS[0].id)
  const audioModel = audioTaskModels.find((m) => m.id === audioModelKey) ?? audioTaskModels[0]
  const [voiceKey, setVoiceKey] = useState(() => AUDIO_VOICES[0].id)

  // 文本节点：普通文本 / 歌词生成
  const [textTask, setTextTask] = useState<"text" | "lyrics">("text")
  const textModel = TEXT_MODELS.find((m) => m.id === modelKey) ?? TEXT_MODELS[0]

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

  /** AI 面板：手动追加的输入图片（存节点 slotImages，键 0,1,2…） */
  const [inputMenuOpen, setInputMenuOpen] = useState(false)
  const [pickingInput, setPickingInput] = useState(false)
  const inputFileRef = useRef<HTMLInputElement | null>(null)
  const extraInputs = Object.entries(node.slotImages ?? {}).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )
  /** 预览区图片编号：连线传入的图片数 + 已追加图片数，用于「图片 N」标签 */
  const baseImgCount = (connectedMedia ?? []).filter((m) => m.kind !== "video" && m.kind !== "audio").length
  const handleInputFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      // 上传：直接填入节点本体（与节点顶部「上传」一致），不产生连线
      onImageUpload?.(node.id, reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
    setInputMenuOpen(false)
  }
  /** 「从画布选择」的可选来源：与当前节点同类型的画布媒体节点 */
  const canvasInputNodes = (() => {
    if (node.kind === "audio") return audioNodes
    if (node.kind === "video") {
      const kinds = currentModeConfig.inputKinds
      const list: { id: string; imageUrl: string; label: string }[] = []
      if (kinds.includes("image")) list.push(...(imageNodes ?? []))
      if (kinds.includes("video")) list.push(...(videoNodes ?? []))
      // 去重
      return list.filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
    }
    return imageNodes
  })()
  const getCanvasInputKind = (id: string): "image" | "video" | "audio" | undefined => {
    if (imageNodes?.some((n) => n.id === id)) return "image"
    if (videoNodes?.some((n) => n.id === id)) return "video"
    if (audioNodes?.some((n) => n.id === id)) return "audio"
    return undefined
  }
  const chooseCanvasInput = (sourceNodeId: string) => {
    // 自动与选中的画布媒体节点建立连线（上游 → 当前节点）
    onLinkNodes?.(sourceNodeId, node.id)
    setPickingInput(false)
    setInputMenuOpen(false)
  }
  const chooseTopCanvas = (sourceNodeId: string) => {
    onLinkNodes?.(sourceNodeId, node.id)
    setPickingTop(false)
    setTopMenuOpen(false)
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
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`上传${mediaLabel}`}
                    title={`点击上传${mediaLabel}或从画布选择`}
                    onClick={() => setTopMenuOpen((v) => !v)}
                    onPointerDown={stop}
                    className="flex items-center gap-1.5 rounded-b-xl border border-t-0 border-border bg-popover/95 px-3 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-primary/15"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    上传
                  </button>
                  {topMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onPointerDown={() => setTopMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute left-1/2 top-full z-50 mt-1 w-32 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl">
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            setTopMenuOpen(false)
                            pickFile()
                          }}
                          className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                        >
                          上传{mediaLabel}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPickingTop(true)
                            setTopMenuOpen(false)
                          }}
                          className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                        >
                          从画布选择
                        </button>
                      </div>
                    </>
                  )}
                  {pickingTop && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onPointerDown={() => setPickingTop(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute left-1/2 top-full z-50 mt-1 max-h-52 w-40 -translate-x-1/2 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-2xl">
                        {canvasInputNodes?.length ? (
                          canvasInputNodes.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                chooseTopCanvas(n.id)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                            >
                              {node.kind === "video" ? (
                                <video
                                  src={n.imageUrl}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-7 w-7 shrink-0 rounded bg-black object-cover"
                                />
                              ) : node.kind === "audio" ? (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                                  <AudioLines className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <img
                                  src={n.imageUrl}
                                  alt={n.label}
                                  className="h-7 w-7 shrink-0 rounded object-cover"
                                />
                              )}
                              <span className="truncate">{n.label}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-xs text-muted-foreground">
                            画布上暂无{inputMediaLabelFor(node.kind, currentModeConfig.inputKinds, mediaLabel)}节点
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
              onLoadedMetadata={(e) =>
                fitNodeToMedia(
                  (e.currentTarget as HTMLVideoElement).videoWidth,
                  (e.currentTarget as HTMLVideoElement).videoHeight,
                )
              }
              className="h-full w-full rounded-xl border border-border/60 bg-black object-cover"
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
              onLoad={(e) =>
                fitNodeToMedia(
                  (e.currentTarget as HTMLImageElement).naturalWidth,
                  (e.currentTarget as HTMLImageElement).naturalHeight,
                )
              }
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
            {/* 输入媒体预览：连线传入 + 追加输入 + 「+ 增加」（上传音频 / 从画布选择→自动连线） */}
            <div className="mb-1 flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
              {(connectedMedia ?? []).map((m, i) => {
                const kindLabel = m.kind === "video" ? "视频" : m.kind === "audio" ? "音频" : "图片"
                const index = connectedMedia!.slice(0, i + 1).filter((x) => x.kind === m.kind).length
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
              {/* 手动追加的输入音频（存 slotImages），hover 可移除 */}
              {extraInputs.map(([slot], i) => (
                <div key={slot} className="group relative flex w-11 flex-col items-center gap-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <AudioLines className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    aria-label="移除输入音频"
                    title="移除"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSlotRemove?.(node.id, Number(slot))
                    }}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] leading-none text-primary-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                  <span className="text-[10px] leading-none text-muted-foreground">
                    {mediaLabel} {baseImgCount + i + 1}
                  </span>
                </div>
              ))}
              {/* + 增加音频：上传 / 从画布选择 */}
              <div className="relative flex w-11 flex-col items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`增加${mediaLabel}`}
                  title={`增加${mediaLabel}（上传或从画布选择）`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (pickingInput) {
                      setPickingInput(false)
                      return
                    }
                    setInputMenuOpen((v) => !v)
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border bg-card/60 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-[10px] leading-none text-muted-foreground">增加</span>
                {inputMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onPointerDown={() => setInputMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute bottom-full left-0 z-50 mb-1 w-32 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          inputFileRef.current?.click()
                        }}
                        className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                      >
                        上传{mediaLabel}
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPickingInput(true)
                          setInputMenuOpen(false)
                        }}
                        className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                      >
                        从画布选择
                      </button>
                    </div>
                  </>
                )}
                {pickingInput && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onPointerDown={() => setPickingInput(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-52 w-40 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-2xl">
                      {canvasInputNodes?.length ? (
                        canvasInputNodes.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              chooseCanvasInput(n.id)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                              <AudioLines className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate">{n.label}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          画布上暂无{mediaLabel}节点
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
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
                <SelectTrigger className="h-8 w-[118px] shrink-0 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择生成任务">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {audioTask === "music" ? (
                      <Music className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{audioTask === "music" ? "音乐" : "文字转语音"}</span>
                  </span>
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
                <SelectTrigger className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupModelsByProvider(audioTaskModels).map(({ provider, models }) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {/* 音色：仅文字转语音 */}
              {audioTask === "tts" && (
                <Select value={voiceKey} onValueChange={setVoiceKey}>
                  <SelectTrigger className="h-8 w-[130px] shrink-0 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择音色">
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
                className="ml-auto flex h-8 items-center gap-1 rounded-full bg-primary/90 px-3.5 text-xs font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? "生成中…" : "生成"}
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

      {/* 文本节点：文本 / 歌词生成面板，选中时出现在节点下方 */}
      {selected && node.kind === "text" &&
        (panelCollapsed ? (
          <button
            type="button"
            onPointerDown={stop}
            onDoubleClick={stop}
            onClick={onTogglePanel}
            className="absolute left-1/2 top-full mt-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg"
          >
            <Type className="h-3.5 w-3.5 text-primary" />
            {textTask === "lyrics" ? "歌词" : "文本"}
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <div
            className="absolute left-1/2 top-full z-20 mt-4 w-[380px] -translate-x-1/2 rounded-2xl border border-border bg-popover p-3 shadow-2xl"
            onPointerDown={stop}
            onDoubleClick={stop}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">AI 文本生成</span>
              </span>
              <button
                type="button"
                aria-label="收起面板"
                title="收起面板"
                onClick={onTogglePanel}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={prompt}
              placeholder={
                textTask === "lyrics"
                  ? "描述你想要的歌词主题、风格或情感"
                  : "描述你想要生成的文本内容"
              }
              rows={3}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  const btn = (e.currentTarget.parentElement?.querySelector("[data-text-generate]") as HTMLElement | null)
                  btn?.click()
                }
              }}
              className="mt-2 w-full cursor-text resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select value={textTask} onValueChange={(v) => setTextTask(v as "text" | "lyrics")}>
                <SelectTrigger className="h-8 w-[84px] shrink-0 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择任务">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {textTask === "lyrics" ? (
                      <Music className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{textTask === "lyrics" ? "歌词" : "文本"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Type className="h-3.5 w-3.5" />
                      文本
                    </span>
                  </SelectItem>
                  <SelectItem value="lyrics">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Music className="h-3.5 w-3.5" />
                      歌词
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={textModel.id} onValueChange={setModelKey}>
                <SelectTrigger className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupModelsByProvider(TEXT_MODELS).map(({ provider, models }) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                data-text-generate
                aria-label="生成"
                title="生成"
                disabled={generating || !prompt.trim()}
                onClick={async () => {
                  const text = prompt.trim()
                  if (!text || !textModel) return
                  const apiKey = ai.apiKeys[textModel.provider]?.trim()
                  if (!apiKey) {
                    toast.error(`请先在设置中填写 ${PROVIDER_LABEL[textModel.provider]} API Key`)
                    return
                  }
                  setGenerating(true)
                  try {
                    const { text: generated } = await generateText({
                      provider: textModel.provider,
                      model: getModelId(textModel, ai.modelIds),
                      prompt: text,
                      apiKey,
                      task: textTask,
                    })
                    onChangeContent(node.id, generated)
                    toast.success(textTask === "lyrics" ? "歌词已生成" : "文本已生成")
                    setPrompt("")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "生成失败")
                  } finally {
                    setGenerating(false)
                  }
                }}
                className="ml-auto flex h-8 items-center gap-1 rounded-full bg-primary/90 px-3.5 text-xs font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? "生成中…" : "生成"}
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>

          </div>
        ))}

      {/* AI 输入面板：选中时出现在节点下方；媒体节点上传后隐藏，空媒体节点仍显示；角色/场景/文本/音频节点不显示（文本、音频节点用各自专用面板） */}
      {selected && !(node.kind === "character" || node.kind === "scene" || node.kind === "text" || node.kind === "audio") &&
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
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{model?.label ?? "AI 生成"}</span>
              </span>
              <button
                type="button"
                aria-label="收起面板"
                title="收起面板"
                onClick={onTogglePanel}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {/* 视频节点模式切换（可用性随接入素材实时变化） */}
            {node.kind === "video" && (
            <div className="mt-2 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {VIDEO_MODE_ORDER.map((mode) => {
                const eligible = isVideoModeEligible(mode)
                const active = activeVideoMode === mode
                return (
                  <span
                    key={mode}
                    className={cn("relative inline-flex shrink-0", !eligible && "cursor-not-allowed")}
                    title={eligible ? VIDEO_MODE_LABELS[mode] : `${VIDEO_MODE_LABELS[mode]}：${VIDEO_MODE_HINTS[mode]}`}
                  >
                    <button
                      type="button"
                      disabled={!eligible}
                      onClick={() => selectVideoMode(mode)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active
                          ? "bg-foreground text-background"
                          : eligible
                            ? "border border-border bg-card text-foreground hover:bg-primary/10"
                            : "border border-border bg-card/50 text-muted-foreground/60",
                      )}
                    >
                      {VIDEO_MODE_LABELS[mode]}
                    </button>
                  </span>
                )
              })}
            </div>
            )}
            {/* 输入媒体预览：连线传入（图片1/视频1…）+ 手动追加的输入图片 + 「+ 增加图片」 */}
            {((node.kind !== "video" && isMedia) ||
              (node.kind === "video" && currentModeConfig.allowsInputs) ||
              (connectedMedia && connectedMedia.length > 0) ||
              extraInputs.length > 0) && (
              <div className="mt-1 flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
                {(connectedMedia ?? []).map((m, i) => {
                  const kindLabel = m.kind === "video" ? "视频" : m.kind === "audio" ? "音频" : "图片"
                  const index = connectedMedia!.slice(0, i + 1).filter((x) => x.kind === m.kind).length
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
                {/* 手动追加的输入媒体（存 slotImages），hover 可移除 */}
                {extraInputs.map(([slot, url], i) => {
                  const slotIsVideo = node.kind === "video" ? isVideoUrl(url) : false
                  const slotLabel = node.kind === "video" ? getSlotLabel(i) : `${mediaLabel} ${baseImgCount + i + 1}`
                  return (
                    <div key={slot} className="group relative flex w-11 flex-col items-center gap-0.5">
                      {slotIsVideo ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-10 w-10 rounded-lg bg-black object-cover ring-1 ring-border"
                        />
                      ) : (
                        <img
                          src={url}
                          alt={`追加输入${mediaLabel} ${i + 1}`}
                          draggable={false}
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                        />
                      )}
                      <button
                        type="button"
                        aria-label="移除输入图片"
                        title="移除"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSlotRemove?.(node.id, Number(slot))
                        }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] leading-none text-primary-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                      >
                        ×
                      </button>
                      <span className="text-[10px] leading-none text-muted-foreground">{slotLabel}</span>
                    </div>
                  )
                })}
                {/* + 增加：上传 / 从画布选择 */}
                {isMedia && (
                  <div className="relative flex w-11 flex-col items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`增加${inputMediaLabelFor(node.kind, currentModeConfig.inputKinds, mediaLabel)}`}
                      title={`增加${inputMediaLabelFor(node.kind, currentModeConfig.inputKinds, mediaLabel)}（上传或从画布选择）`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (pickingInput) {
                          setPickingInput(false)
                          return
                        }
                        setInputMenuOpen((v) => !v)
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border bg-card/60 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] leading-none text-muted-foreground">增加</span>

                    {inputMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onPointerDown={() => setInputMenuOpen(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute bottom-full left-0 z-50 mb-1 w-32 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl">
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              setInputMenuOpen(false)
                              inputFileRef.current?.click()
                            }}
                            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                          >
                            上传{inputMediaLabelFor(node.kind, currentModeConfig.inputKinds, mediaLabel)}
                          </button>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              setPickingInput(true)
                              setInputMenuOpen(false)
                            }}
                            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                          >
                            从画布选择
                          </button>
                        </div>
                      </>
                    )}
                    {pickingInput && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onPointerDown={() => setPickingInput(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-52 w-40 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-2xl">
                          {canvasInputNodes?.length ? (
                            canvasInputNodes.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  chooseCanvasInput(n.id)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs text-popover-foreground transition-colors hover:bg-primary/15"
                              >
                                {(() => {
                                  const kind = node.kind === "video" ? getCanvasInputKind(n.id) : node.kind
                                  if (kind === "video") {
                                    return (
                                      <video
                                        src={n.imageUrl}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        className="h-7 w-7 shrink-0 rounded bg-black object-cover"
                                      />
                                    )
                                  }
                                  if (kind === "audio") {
                                    return (
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                                        <AudioLines className="h-3.5 w-3.5" />
                                      </span>
                                    )
                                  }
                                  return (
                                    <img
                                      src={n.imageUrl}
                                      alt={n.label}
                                      className="h-7 w-7 shrink-0 rounded object-cover"
                                    />
                                  )
                                })()}
                                <span className="truncate">{n.label}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                              画布上暂无{inputMediaLabelFor(node.kind, currentModeConfig.inputKinds, mediaLabel)}节点
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {node.kind === "video" && activeVideoMode === "extend" && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  onClick={() => toast.info("向后延长参数可在设置中调整")}
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center">↔</span>
                  向后延长
                </button>
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                value={modelKey}
                onValueChange={(id) => {
                  setModelKey(id)
                  const nextMax = id === "seedance-2.5" ? 30 : 15
                  setVidDuration((d) => Math.min(d, nextMax))
                }}
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 rounded-lg border-transparent bg-card text-xs font-medium text-foreground shadow-none hover:bg-card/70" aria-label="选择模型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupModelsByProvider(modelOptions).map(({ provider, models }) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {/* 画面比例：网格弹层选择，选中预设自动适配输出宽高 */}
              {showRatio && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="选择画面比例"
                    title={`输出尺寸 ${outW > 0 ? `${outW}×${outH}` : "自适应"}`}
                    onClick={() => setRatioOpen((v) => !v)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border-transparent bg-card px-2.5 text-xs font-medium text-foreground shadow-none transition-colors hover:bg-card/70"
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center">
                      <span
                        className="rounded-[2px] border border-muted-foreground"
                        style={{
                          width: ratioKey === "adaptive" || isCustomRatio ? 10 : 14,
                          height: ratioKey === "adaptive" || isCustomRatio ? 10 : 10,
                        }}
                      />
                    </span>
                    {node.kind === "video"
                      ? `${ratioLabel} / ${vidResolution} / ${vidDuration}s`
                      : ratioLabel}
                  </button>
                  {ratioOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setRatioOpen(false)} aria-hidden />
                      <div
                        className={cn(
                          "absolute bottom-full left-0 z-40 mb-2 rounded-2xl border border-border bg-popover p-3 shadow-2xl",
                          node.kind === "video" ? "w-[300px]" : "w-[264px]",
                        )}
                      >
                        {node.kind === "video" ? (
                          <div>
                            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">比例</div>
                            <div className="grid grid-cols-5 gap-1">
                              {ratioPresets.map((r) => {
                                const sel = ratioKey === r.id
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => {
                                      setRatioKey(r.id)
                                      setRatioOpen(false)
                                    }}
                                    className={cn(
                                      "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors",
                                      sel ? "bg-foreground/10" : "hover:bg-primary/10",
                                    )}
                                  >
                                    <span className="flex h-4 items-center justify-center">
                                      <span
                                        className="rounded-[2px] border-2 border-foreground"
                                        style={{
                                          width: r.w >= r.h ? 16 : (16 * r.w) / r.h,
                                          height: r.w >= r.h ? (16 * r.h) / r.w : 16,
                                        }}
                                      />
                                    </span>
                                    <span className="text-[10px] font-medium text-foreground">{r.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* 比例：一行 5 个 */}
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">比例</div>
                              <div className="grid grid-cols-5 gap-1">
                                {ratioPresets.map((r) => {
                                  const sel = ratioKey === r.id
                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      onClick={() => {
                                        setRatioKey(r.id)
                                        setRatioOpen(false)
                                      }}
                                      className={cn(
                                        "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors",
                                        sel ? "bg-foreground/10" : "hover:bg-primary/10",
                                      )}
                                    >
                                      <span className="flex h-4 items-center justify-center">
                                        <span
                                          className="rounded-[2px] border-2 border-foreground"
                                          style={{
                                            width: r.w >= r.h ? 16 : (16 * r.w) / r.h,
                                            height: r.w >= r.h ? (16 * r.h) / r.w : 16,
                                          }}
                                        />
                                      </span>
                                      <span className="text-[10px] font-medium text-foreground">{r.label}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            {/* 图像质量：分段控件 */}
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">图像质量</div>
                              <div className="flex rounded-lg bg-card p-0.5">
                                {([
                                  { v: "low" as const, label: "低" },
                                  { v: "medium" as const, label: "中" },
                                  { v: "high" as const, label: "高" },
                                ]).map((q) => (
                                  <button
                                    key={q.v}
                                    type="button"
                                    onClick={() => setImgQuality(q.v)}
                                    className={cn(
                                      "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                                      imgQuality === q.v
                                        ? "bg-foreground/15 text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    {q.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* 分辨率：分段控件 */}
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">分辨率</div>
                              <div className="flex rounded-lg bg-card p-0.5">
                                {(["1k", "2k", "4k"] as const).map((res) => (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => setImgRes(res)}
                                    className={cn(
                                      "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                                      imgRes === res
                                        ? "bg-foreground/15 text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    {res.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 视频节点附加设置：分辨率 / 生成时长 / 生成视频音频 */}
                        {node.kind === "video" && (
                          <div className="mt-3 space-y-3 border-t border-border pt-3">
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">分辨率</div>
                              <div className="flex rounded-lg bg-card p-0.5">
                                {VIDEO_RESOLUTIONS.map((res) => (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => setVidResolution(res)}
                                    className={cn(
                                      "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                                      vidResolution === res
                                        ? "bg-foreground/15 text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    {res}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-medium text-muted-foreground">生成时长</span>
                                <span className="rounded-md bg-card px-2 py-0.5 text-xs text-foreground">
                                  {vidDuration} 秒
                                </span>
                              </div>
                              <input
                                type="range"
                                min={4}
                                max={maxVidDuration}
                                step={1}
                                value={vidDuration}
                                onChange={(e) => setVidDuration(Number(e.target.value))}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="w-full accent-primary"
                                aria-label="生成时长"
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">生成视频音频</div>
                              <div className="flex rounded-lg bg-card p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setVidAudio(true)}
                                  className={cn(
                                    "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                                    vidAudio
                                      ? "bg-foreground/15 text-foreground"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  是
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVidAudio(false)}
                                  className={cn(
                                    "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                                    !vidAudio
                                      ? "bg-foreground/15 text-foreground"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  否
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              {showRatio && isCustomRatio && (
                <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-card px-2">
                  <input
                    type="number"
                    min={64}
                    value={customW}
                    aria-label="输出宽度"
                    title="输出宽度"
                    onChange={(e) => setCustomW(e.target.value)}
                    className="h-6 w-14 bg-transparent text-xs text-foreground outline-none"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <input
                    type="number"
                    min={64}
                    value={customH}
                    aria-label="输出高度"
                    title="输出高度"
                    onChange={(e) => setCustomH(e.target.value)}
                    className="h-6 w-14 bg-transparent text-xs text-foreground outline-none"
                  />
                </div>
              )}
              <button
                type="button"
                aria-label="生成"
                title="生成"
                disabled={generating || !prompt.trim()}
                onClick={async () => {
                  const text = prompt.trim()
                  if (!text || !model) return
                  if (model.kind === "video" && activeVideoMode !== "text2video") {
                    toast.info(`${VIDEO_MODE_LABELS[activeVideoMode]} 模式正在接入中，敬请期待`)
                    return
                  }
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
                      const refs = [
                        ...(connectedMedia ?? [])
                          .filter((m) => m.kind === "image")
                          .map((m) => m.url),
                        ...Object.values(node.slotImages ?? {}),
                      ]
                      const { dataUrl } = await generateImage({
                        provider: model.provider,
                        model: upstreamModel,
                        prompt: text,
                        apiKey,
                        aspectRatio: ratioValue,
                        width: outW || undefined,
                        height: outH || undefined,
                        quality: imgQuality,
                        imageRes: imgRes,
                        references: refs.length ? refs : undefined,
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
                        ratio: ratioValue,
                        width: outW || undefined,
                        height: outH || undefined,
                        resolution: vidResolution,
                        duration: vidDuration,
                        generateAudio: vidAudio,
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
                className="ml-auto flex h-7 items-center gap-1 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-transform hover:scale-105 disabled:opacity-50"
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
      {/* 追加输入媒体的文件选择（图片/视频/音频面板共用） */}
      <input
        ref={inputFileRef}
        type="file"
        accept={(() => {
          if (node.kind === "audio") return "audio/*"
          if (node.kind === "video") {
            const kinds = currentModeConfig.inputKinds
            if (kinds.includes("image") && kinds.includes("video")) return "image/*,video/*"
            if (kinds.includes("video")) return "video/*"
            return "image/*"
          }
          return "image/*"
        })()}
        className="hidden"
        onChange={handleInputFileChange}
      />
    </div>
  )
}
