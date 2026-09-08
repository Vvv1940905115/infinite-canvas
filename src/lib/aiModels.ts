// AI 模型注册表：视频（Seedance/火山方舟）、图片（Gemini/OpenAI）与音频（MiniMax 语音/音乐）模型定义。
// 上游模型 ID 默认值可在设置面板覆盖（aiSettings.modelIds）。

export type AiProvider = "gemini" | "openai" | "seedance" | "minimax"

export interface AiModel {
  /** 稳定键：下拉 value + localStorage 覆盖映射的 key */
  id: string
  /** 下拉展示名 */
  label: string
  provider: AiProvider
  kind: "image" | "video" | "audio"
  /** 音频模型子任务：tts = 文字转语音，music = 音乐生成 */
  task?: "tts" | "music"
  /** 上游模型 ID 默认值（可在设置面板覆盖） */
  defaultModelId: string
  help?: string
}

export const IMAGE_MODELS: AiModel[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    provider: "gemini",
    kind: "image",
    defaultModelId: "gemini-2.5-flash-image",
  },
  {
    id: "gpt-image-1",
    label: "OpenAI gpt-image-1",
    provider: "openai",
    kind: "image",
    defaultModelId: "gpt-image-1",
  },
]

export const VIDEO_MODELS: AiModel[] = [
  {
    id: "seedance-2.0",
    label: "Seedance 2.0",
    provider: "seedance",
    kind: "video",
    defaultModelId: "doubao-seedance-2-0-260128",
  },
  {
    id: "seedance-2.5",
    label: "Seedance 2.5",
    provider: "seedance",
    kind: "video",
    defaultModelId: "doubao-seedance-2-5-260825",
    help: "默认 ID 为按命名规律推测的值，可在下方修改为方舟控制台的实际模型 ID",
  },
]

export const AUDIO_MODELS: AiModel[] = [
  {
    id: "minimax-speech-2.8-turbo",
    label: "Minimax-Speech-2.8-Turbo",
    provider: "minimax",
    kind: "audio",
    task: "tts",
    defaultModelId: "MiniMax-Speech-2.8-Turbo",
  },
  {
    id: "minimax-music-1.5",
    label: "Minimax-Music-1.5",
    provider: "minimax",
    kind: "audio",
    task: "music",
    defaultModelId: "music-1.5",
    help: "默认 ID 为常见值，可在下方修改为 MiniMax 控制台的实际模型 ID",
  },
]

/** TTS 音色列表（MiniMax 系统音色 voice_id） */
export interface AiVoice {
  id: string
  label: string
}

export const AUDIO_VOICES: AiVoice[] = [
  { id: "female-chengshu", label: "智慧女性" },
  { id: "female-shaonv", label: "少女音色" },
  { id: "female-yujie", label: "御姐音色" },
  { id: "male-qn-qingse", label: "青涩青年" },
  { id: "male-qn-jingying", label: "精英青年" },
  { id: "presenter_female", label: "主持人女声" },
  { id: "presenter_male", label: "主持人男声" },
]

export function modelsForKind(kind: "image" | "video" | "audio"): AiModel[] {
  if (kind === "video") return VIDEO_MODELS
  if (kind === "audio") return AUDIO_MODELS
  return IMAGE_MODELS
}

export function getModelById(id: string): AiModel | undefined {
  return [...IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS].find((m) => m.id === id)
}

/** 设置面板覆盖优先，否则用默认值 */
export function getModelId(model: AiModel, overrides: Record<string, string>): string {
  const v = overrides?.[model.id]?.trim()
  return v || model.defaultModelId
}

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  seedance: "Seedance（火山方舟）",
  minimax: "MiniMax",
}
