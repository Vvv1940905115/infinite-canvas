import { useEffect, useMemo, useState } from "react"
import { X, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export type AssetCategory = "all" | "image" | "video" | "audio" | "character" | "scene" | "prop" | "style" | "product" | "other"

export const ASSET_CATEGORIES: { key: AssetCategory; label: string; folder: string }[] = [
  { key: "all", label: "全部", folder: "all" },
  { key: "image", label: "图片", folder: "图片" },
  { key: "video", label: "视频", folder: "视频" },
  { key: "audio", label: "音频", folder: "音频" },
]

export interface AssetFile {
  category: string
  name: string
  path: string
  mtime: number
}

interface AssetLibraryPanelProps {
  open: boolean
  onClose: () => void
  assetRoot?: string
  refreshKey?: number
  onUseAsset?: (asset: AssetFile) => void
}

export function AssetLibraryPanel({ open, onClose, assetRoot, refreshKey, onUseAsset }: AssetLibraryPanelProps) {
  const [active, setActive] = useState<AssetCategory>("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<AssetFile[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/list-assets?root=${encodeURIComponent(assetRoot || "")}`)
      const data = (await res.json()) as {
        ok?: boolean
        assets?: { category: string; files: { name: string; path: string; mtime: number }[] }[]
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "加载失败")
      const flat: AssetFile[] = []
      for (const group of data.assets || []) {
        for (const f of group.files) {
          flat.push({ category: group.category, name: f.name, path: f.path, mtime: f.mtime })
        }
      }
      flat.sort((a, b) => b.mtime - a.mtime)
      setAssets(flat)
    } catch (err: any) {
      setError(err?.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open, assetRoot, refreshKey])

  const filtered = useMemo(() => {
    const categoryFolder = ASSET_CATEGORIES.find((c) => c.key === active)?.folder
    return assets.filter((a) => {
      const matchCategory = active === "all" || a.category === categoryFolder
      const q = query.trim().toLowerCase()
      const matchQuery = !q || a.name.toLowerCase().includes(q)
      return matchCategory && matchQuery
    })
  }, [assets, active, query])

  if (!open) return null

  return (
    <aside className="absolute left-20 top-4 z-30 flex h-[calc(100%-2rem)] w-80 flex-col rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">资源库</span>
        <button
          type="button"
          aria-label="关闭资源库"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索资源"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* 分类标签栏 */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {ASSET_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActive(cat.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-card/60 text-muted-foreground hover:bg-primary/15 hover:text-foreground",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载中…
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>{error}</span>
            <button
              type="button"
              onClick={load}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              重试
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            当前分类「{ASSET_CATEGORIES.find((c) => c.key === active)?.label}」暂无资源
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((asset) => {
              const kind = asset.category === "视频" ? "video" : asset.category === "音频" ? "audio" : "image"
              return (
                <button
                  key={`${asset.category}/${asset.name}`}
                  type="button"
                  onClick={() => onUseAsset?.(asset)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-black/40">
                    {kind === "image" ? (
                      <img
                        src={asset.path}
                        alt={asset.name}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : kind === "video" ? (
                      <video src={asset.path} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <span className="text-3xl">♪</span>
                        <span className="text-[11px]">音频</span>
                      </div>
                    )}
                  </div>
                  <span className="truncate px-2 py-1.5 text-[11px] text-muted-foreground" title={asset.name}>
                    {asset.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
