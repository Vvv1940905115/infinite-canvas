import { useCallback, useEffect, useState } from "react"

/**
 * 画布路径配置
 * 纯前端环境无法直接写入真实文件系统，路径以 localStorage 持久化，
 * 供「画布自动保存 / 资源库」等模块随时读取。
 */

export interface PathConfig {
  /** 画布自动保存路径：当前画布变更后自动导出 JSON，方便更换版本后导入 */
  canvasAutoSave: string
  /** 资源库路径：AI 生成的图片/视频/音频自动保存到此根目录下的对应分类子文件夹 */
  assetLibrary: string
  /** 主题模板路径：导入或编辑后的主题 JSON 保存在此 */
  themeTemplate: string
}

export type PathKey = keyof PathConfig

export const PATH_META: { key: PathKey; label: string; hint: string }[] = [
  {
    key: "canvasAutoSave",
    label: "画布自动保存路径",
    hint: "当前画布变更后自动导出 JSON，方便更换版本后导入",
  },
  {
    key: "assetLibrary",
    label: "资源库路径",
    hint: "AI 生成的图片/视频/音频自动保存到此根目录，并按「图片/视频/音频」分子文件夹",
  },
  {
    key: "themeTemplate",
    label: "主题模板路径",
    hint: "导入或编辑后的主题 JSON 保存在此路径",
  },
]

const STORAGE_KEY = "vibex.canvas.paths"

const DEFAULT_PATHS: PathConfig = {
  canvasAutoSave: "D:/infinite-canvas/output/canvas",
  assetLibrary: "D:/infinite-canvas/output/assets",
  themeTemplate: "D:/infinite-canvas/output/themes",
}

function readPaths(): PathConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PATHS }
    const parsed = JSON.parse(raw) as Partial<PathConfig>
    // 清理旧版已删除的字段
    const next: any = { ...DEFAULT_PATHS, ...parsed }
    delete next.assetLibraryImage
    delete next.assetLibraryVideo
    delete next.assetLibraryAudio
    delete next.fileAutoSave
    return next as PathConfig
  } catch {
    return { ...DEFAULT_PATHS }
  }
}

/** 读取当前已保存的路径配置（非响应式，适合在命令式逻辑中调用） */
export function getPaths(): PathConfig {
  return readPaths()
}

/** 调用 Vite dev server 后端打开本地文件夹 */
export async function openInExplorer(dirPath: string): Promise<void> {
  const normalized = (dirPath || "").replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalized) return
  try {
    const res = await fetch(`/api/open-folder?path=${encodeURIComponent(normalized)}`)
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      console.warn("[open-folder] failed:", data.error || res.statusText)
    }
  } catch {
    /* 静默忽略（如服务未启动） */
  }
}

/** 保存完整路径配置到 localStorage，立即生效 */
export function savePaths(next: PathConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 忽略持久化失败（如隐私模式） */
  }
}

/** 响应式路径配置 hook：就地编辑、保存后立即生效，并跨标签页同步 */
export function usePaths() {
  const [paths, setPaths] = useState<PathConfig>(readPaths)

  const update = useCallback((key: PathKey, value: string) => {
    setPaths((prev) => {
      const next = { ...prev, [key]: value }
      savePaths(next)
      return next
    })
  }, [])

  const save = useCallback((next: PathConfig) => {
    setPaths(next)
    savePaths(next)
  }, [])

  const reset = useCallback(() => {
    setPaths({ ...DEFAULT_PATHS })
    savePaths({ ...DEFAULT_PATHS })
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setPaths({ ...DEFAULT_PATHS, ...JSON.parse(e.newValue) })
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return { paths, update, save, reset }
}
