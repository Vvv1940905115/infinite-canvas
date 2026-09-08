// AI 模型注册表：视频（Seedance/火山方舟）与图片（Gemini/OpenAI）模型定义。
// 上游模型 ID 默认值可在设置面板覆盖（aiSettings.modelIds）。

export type AiProvider = "gemini" | "openai" | "seedance"

export interface AiModel {
  /** 稳定键：下拉 value + localStorage 覆盖映射的 key */
  id: string
  /** 下拉展示名 */
  label: string
  provider: AiProvider
  kind: "image" | "video"
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

export function modelsForKind(kind: "image" | "video"): AiModel[] {
  return kind === "video" ? VIDEO_MODELS : IMAGE_MODELS
}

export function getModelById(id: string): AiModel | undefined {
  return [...IMAGE_MODELS, ...VIDEO_MODELS].find((m) => m.id === id)
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
}
