import { FolderOpen, Upload } from "lucide-react"
import { UploadedAssetsSection } from "./UploadedAssetsSection"
import type { AssetFile } from "./AssetLibraryPanel"

interface AddMenuProps {
  open: boolean
  /** 上传：选择本地图片/视频导入画布 */
  onUpload: () => void
  /** 从作品导入：调取历史作品素材 */
  onImport: () => void
  onClose: () => void
  assetRoot?: string
  /** 点击已上传素材：添加到画布 */
  onUseAsset: (asset: AssetFile) => void
}

export function AddMenu({ open, onUpload, onImport, onClose, assetRoot, onUseAsset }: AddMenuProps) {
  if (!open) return null
  return (
    <>
      {/* 菜单外点击 = 关闭 */}
      <div className="absolute inset-0 z-40 cursor-default" onClick={onClose} aria-hidden />
      <div className="absolute left-20 top-1/2 z-50 w-60 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="px-4 pb-1.5 pt-3 text-xs font-semibold tracking-widest text-muted-foreground">
          素材导入
        </div>
        <div className="space-y-0.5 px-2 pb-2">
          <button
            type="button"
            onClick={onUpload}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Upload className="h-4 w-4 shrink-0" />
            上传文件
            <span className="ml-auto text-xs text-muted-foreground">本地图片/视频</span>
          </button>
          <button
            type="button"
            onClick={onImport}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            从作品导入
            <span className="ml-auto text-xs text-muted-foreground">历史素材</span>
          </button>
        </div>
        <UploadedAssetsSection assetRoot={assetRoot} onUse={onUseAsset} />
      </div>
    </>
  )
}
