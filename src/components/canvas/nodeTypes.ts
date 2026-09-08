import {
  Box,
  Clapperboard,
  FileText,
  FolderOpen,
  Image,
  LayoutGrid,
  Layers,
  Map,
  Music,
  Scissors,
  Type,
  Upload,
  User,
  Video,
  type LucideIcon,
} from "lucide-react"

export type NodeKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "character"
  | "scene"
  | "world3d"
  | "director"
  | "script"
  | "storyboard"
  | "compose"
  | "quickcut"
  | "upload"
  | "import"

export interface NodeMeta {
  label: string
  icon: LucideIcon
  w: number
  h: number
  hint: string
}

export const NODE_META: Record<NodeKind, NodeMeta> = {
  text: { label: "文本", icon: Type, w: 240, h: 220, hint: "AI 生成文案、歌词与文本内容" },
  image: { label: "图片", icon: Image, w: 244, h: 184, hint: "概念图、剧照参考" },
  video: { label: "视频", icon: Video, w: 264, h: 176, hint: "镜头片段、参考影像" },
  audio: { label: "音频", icon: Music, w: 228, h: 128, hint: "配乐、音效与台词录音" },
  character: { label: "角色", icon: User, w: 232, h: 260, hint: "角色设定、造型与表演参考" },
  scene: { label: "场景", icon: Map, w: 248, h: 276, hint: "场景空间、环境与气氛参考" },
  world3d: { label: "3D 世界", icon: Box, w: 248, h: 176, hint: "场景空间与机位调度" },
  director: { label: "导演台", icon: Clapperboard, w: 244, h: 152, hint: "导演决策与镜头指令" },
  script: { label: "脚本", icon: FileText, w: 224, h: 160, hint: "剧本段落与故事大纲" },
  storyboard: { label: "分镜格子", icon: LayoutGrid, w: 304, h: 208, hint: "分镜网格与镜头排序" },
  compose: { label: "视频合成", icon: Layers, w: 264, h: 176, hint: "合成输出的时间线" },
  quickcut: { label: "快捷剪辑", icon: Scissors, w: 228, h: 136, hint: "快速剪接与片段拼接" },
  upload: { label: "上传文件", icon: Upload, w: 224, h: 136, hint: "本地素材占位" },
  import: { label: "从作品导入", icon: FolderOpen, w: 232, h: 136, hint: "历史作品素材占位" },
}

export const NODE_KINDS: NodeKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "character",
  "scene",
  "compose",
  "quickcut",
]

export const RESOURCE_KINDS: NodeKind[] = ["upload", "import"]
