import { FolderOpen, KeyRound, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PATH_META, openInExplorer, type PathConfig, type PathKey } from "@/lib/paths"
import { AUDIO_MODELS, IMAGE_MODELS, VIDEO_MODELS } from "@/lib/aiModels"
import type { AiSection, AiSettings } from "@/lib/aiSettings"

interface SettingsPanelProps {
  open: boolean
  paths: PathConfig
  onUpdate: (key: PathKey, value: string) => void
  onReset: () => void
  ai: AiSettings
  onAiUpdate: (section: AiSection, key: string, value: string) => void
  onAiReset: () => void
  onClose: () => void
}

const AI_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS]

/**
 * 设置面板：直接嵌入画布界面右侧，无需弹窗 / 跳转。
 * 含「路径设置」与「模型设置」两个区块，均就地修改、即时保存（立即生效）。
 */
export function SettingsPanel({
  open,
  paths,
  onUpdate,
  onReset,
  ai,
  onAiUpdate,
  onAiReset,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null

  return (
    <aside
      className={cn(
        "absolute right-4 top-16 z-40 flex max-h-[calc(100vh-5rem)] w-[340px] flex-col rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">设置</h2>
        </div>
        <button
          type="button"
          aria-label="关闭设置"
          title="关闭"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* 路径设置 */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            路径设置
          </h3>
          {PATH_META.map(({ key, label, hint }) => (
            <label key={key} className="block space-y-1.5">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <div className="flex items-center gap-1.5">
                <Input
                  value={paths[key]}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="请输入路径，例如 D:/infinite-canvas/output/files"
                  onChange={(e) => onUpdate(key, e.target.value)}
                  aria-label={label}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label={`打开 ${label}`}
                  title={`打开文件夹：${paths[key] || "未设置"}`}
                  disabled={!paths[key]}
                  onClick={() => openInExplorer(paths[key])}
                  className={cn(
                    "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors",
                    paths[key]
                      ? "text-muted-foreground hover:bg-primary/15 hover:text-foreground active:bg-primary/25"
                      : "cursor-not-allowed opacity-40",
                  )}
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
              <span className="block text-xs leading-relaxed text-muted-foreground">{hint}</span>
            </label>
          ))}
        </section>

        {/* 模型设置 */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              模型设置
            </h3>
            <Button variant="ghost" size="sm" onClick={onAiReset} className="h-6 px-2 text-xs">
              恢复默认
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            API Key 仅保存在本地浏览器，经本地代理转发给对应 AI 服务商，不会上传到其他服务器。请勿在共享电脑上使用。
          </p>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">Gemini API Key</span>
            <Input
              type="password"
              value={ai.apiKeys.gemini}
              spellCheck={false}
              autoComplete="off"
              placeholder="AIza..."
              onChange={(e) => onAiUpdate("apiKeys", "gemini", e.target.value)}
              className="flex-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">OpenAI API Key</span>
            <Input
              type="password"
              value={ai.apiKeys.openai}
              spellCheck={false}
              autoComplete="off"
              placeholder="sk-..."
              onChange={(e) => onAiUpdate("apiKeys", "openai", e.target.value)}
              className="flex-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">Seedance API Key（火山方舟）</span>
            <Input
              type="password"
              value={ai.apiKeys.seedance}
              spellCheck={false}
              autoComplete="off"
              placeholder="ARK_API_KEY"
              onChange={(e) => onAiUpdate("apiKeys", "seedance", e.target.value)}
              className="flex-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">MiniMax API Key（语音 / 音乐）</span>
            <Input
              type="password"
              value={ai.apiKeys.minimax}
              spellCheck={false}
              autoComplete="off"
              placeholder="eyJ..."
              onChange={(e) => onAiUpdate("apiKeys", "minimax", e.target.value)}
              className="flex-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">MiniMax GroupId</span>
            <Input
              value={ai.apiKeys.minimaxGroup}
              spellCheck={false}
              autoComplete="off"
              placeholder="MiniMax 账号 GroupId"
              onChange={(e) => onAiUpdate("apiKeys", "minimaxGroup", e.target.value)}
              className="flex-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">火山方舟 Base URL</span>
            <Input
              value={ai.baseUrl}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://ark.cn-beijing.volces.com/api/v3"
              onChange={(e) => onAiUpdate("baseUrl", "", e.target.value)}
              className="flex-1"
            />
          </label>
          {AI_MODELS.map((m) => (
            <label key={m.id} className="block space-y-1.5">
              <span className="block text-sm font-medium text-foreground">
                {m.label} · 模型 ID
              </span>
              <Input
                value={ai.modelIds[m.id] || ""}
                spellCheck={false}
                autoComplete="off"
                placeholder={m.defaultModelId}
                onChange={(e) => onAiUpdate("modelIds", m.id, e.target.value)}
                className="flex-1"
              />
              {m.help && <span className="block text-xs text-muted-foreground">{m.help}</span>}
            </label>
          ))}
        </section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onReset}>
          恢复默认路径
        </Button>
        <span className="text-xs text-muted-foreground">修改后即时保存生效</span>
      </footer>
    </aside>
  )
}
