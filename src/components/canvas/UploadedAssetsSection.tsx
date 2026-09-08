import { useEffect, useState } from "react"
import { AudioLines, ChevronRight, Image as ImageIcon, Video, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AssetFile } from "./AssetLibraryPanel"

interface UploadedAssetsSectionProps {
  assetRoot?: string
  /** 点击素材：添加到画布 */
  onUse: (asset: AssetFile) => void
}

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon }> = {
  图片: { label: "图片", icon: ImageIcon },
  视频: { label: "视频", icon: Video },
  音频: { label: "音频", icon: AudioLines },
}

/** 已上传素材区：列出资源库中已有的素材（按 图片/视频/音频 分类，可展开子列表） */
export function UploadedAssetsSection({ assetRoot, onUse }: UploadedAssetsSectionProps) {
  const [data, setData] = useState<{ category: string; files: AssetFile[] }[] | null>(null)
  const [openCat, setOpenCat] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/list-assets?root=${encodeURIComponent(assetRoot || "")}`)
        const d = (await res.json()) as { ok?: boolean; assets?: { category: string; files: AssetFile[] }[] }
        if (!alive || !d?.ok) return
        setData(d.assets || [])
      } catch {
        /* 资源库不可用时静默降级 */
      }
    })()
    return () => {
      alive = false
    }
  }, [assetRoot])

  const nonEmpty = (data || []).filter((c) => c.files.length > 0)
  if (nonEmpty.length === 0) return null

  return (
    <div className="border-t border-border/70 px-2 pb-2 pt-2">
      <div className="px-1 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground">
        已上传
      </div>
      <div className="space-y-0.5">
        {nonEmpty.map((cat) => {
          const meta = CATEGORY_META[cat.category] || { label: cat.category, icon: ImageIcon }
          const Icon = meta.icon
          const open = openCat === cat.category
          return (
            <div key={cat.category}>
              <button
                type="button"
                onClick={() => setOpenCat(open ? null : cat.category)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {meta.label}
                <span className="ml-auto text-xs text-muted-foreground">{cat.files.length}</span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    open && "rotate-90",
                  )}
                />
              </button>
              {open && (
                <div className="mt-0.5 max-h-40 space-y-0.5 overflow-y-auto pl-3">
                  {cat.files.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      title={f.name}
                      onClick={() => onUse(f)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {cat.category === "图片" ? (
                        <img src={f.path} alt={f.name} className="h-7 w-7 shrink-0 rounded object-cover" />
                      ) : (
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
