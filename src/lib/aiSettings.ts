import { useCallback, useEffect, useState } from "react"

/**
 * AI 模型设置：API Key 与上游模型 ID 覆盖。
 * 仅存本地浏览器 localStorage，经本地 Vite 代理转发给对应 AI 服务商。
 */

export interface AiSettings {
  apiKeys: { gemini: string; openai: string; seedance: string; minimax: string; minimaxGroup: string }
  /** 火山方舟 base URL */
  baseUrl: string
  /** model.id -> 上游模型 ID 覆盖；空串 = 用默认 */
  modelIds: Record<string, string>
}

export type AiSection = "apiKeys" | "modelIds" | "baseUrl"

const STORAGE_KEY = "vibex.canvas.ai"

const DEFAULT_AI: AiSettings = {
  apiKeys: { gemini: "", openai: "", seedance: "", minimax: "", minimaxGroup: "" },
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  modelIds: {},
}

function readAi(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AI }
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    return {
      apiKeys: { ...DEFAULT_AI.apiKeys, ...(parsed.apiKeys || {}) },
      baseUrl: parsed.baseUrl || DEFAULT_AI.baseUrl,
      modelIds: parsed.modelIds || {},
    }
  } catch {
    return { ...DEFAULT_AI }
  }
}

/** 读取当前已保存的 AI 设置（非响应式，适合命令式场景） */
export function getAiSettings(): AiSettings {
  return readAi()
}

/** 保存完整 AI 设置到 localStorage，立即生效 */
export function saveAiSettings(next: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 忽略持久化失败（如隐私模式） */
  }
}

/** 响应式 AI 设置 hook：就地编辑、保存后立即生效，并跨标签页同步 */
export function useAiSettings() {
  const [ai, setAi] = useState<AiSettings>(readAi)

  const update = useCallback((section: AiSection, key: string, value: string) => {
    setAi((prev) => {
      const next: AiSettings = { ...prev }
      if (section === "baseUrl") {
        next.baseUrl = value
      } else {
        next[section] = { ...prev[section], [key]: value } as AiSettings["apiKeys"]
      }
      saveAiSettings(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const next = { ...DEFAULT_AI }
    setAi(next)
    saveAiSettings(next)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Partial<AiSettings>
          setAi({
            apiKeys: { ...DEFAULT_AI.apiKeys, ...(parsed.apiKeys || {}) },
            baseUrl: parsed.baseUrl || DEFAULT_AI.baseUrl,
            modelIds: parsed.modelIds || {},
          })
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return { ai, update, reset }
}
