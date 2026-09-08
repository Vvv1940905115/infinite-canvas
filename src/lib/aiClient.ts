import type { AiProvider } from "./aiModels"

// 浏览器侧 AI 生成客户端：经本地 Vite 代理（/api/ai/*）调用上游，规避 CORS。

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) throw new Error(data?.error || `请求失败 (${res.status})`)
  return data as T
}

export interface GenerateImageReq {
  provider: AiProvider
  model: string
  prompt: string
  apiKey: string
  /** 画面比例（9:16 / 16:9 / 1:1 / 3:4 / 4:3），自定义宽高时可不传 */
  aspectRatio?: string
  /** 自定义输出宽（px），与 height 一起覆盖预设比例 */
  width?: number
  height?: number
  /** 图像质量（OpenAI gpt-image-1：low / medium / high） */
  quality?: "low" | "medium" | "high"
  /** 图像分辨率（Gemini：1k / 2k / 4k） */
  imageRes?: "1k" | "2k" | "4k"
  /** 参考图片 data URL 或 /api/asset 路径 */
  references?: string[]
}

export async function generateImage(req: GenerateImageReq): Promise<{ dataUrl: string }> {
  return post("/api/ai/image", req)
}

export interface GenerateTextReq {
  provider: AiProvider
  model: string
  prompt: string
  apiKey: string
  /** text = 普通文本，lyrics = 歌词 */
  task: "text" | "lyrics"
}

export async function generateText(req: GenerateTextReq): Promise<{ text: string }> {
  return post("/api/ai/text", req)
}

export interface GenerateSpeechReq {
  /** 上游模型 ID（MiniMax-Speech-2.8-Turbo / music-1.5 等） */
  model: string
  /** tts = 文字转语音，music = 音乐生成 */
  task: "tts" | "music"
  /** 要转换的文本（tts）或音乐描述/歌词（music） */
  text: string
  /** TTS 音色 voice_id（task 为 music 时忽略） */
  voice?: string
  apiKey: string
  /** MiniMax 账号 GroupId */
  groupId: string
}

export async function generateSpeech(req: GenerateSpeechReq): Promise<{ dataUrl: string }> {
  return post("/api/ai/tts", req)
}

export interface SubmitVideoReq {
  model: string
  prompt: string
  apiKey: string
  base: string
  /** 画面比例（16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / adaptive） */
  ratio?: string
  /** 自定义输出宽高（px） */
  width?: number
  height?: number
  /** 分辨率档位（480p / 720p / 1080p） */
  resolution?: string
  /** 生成时长（秒，4-12） */
  duration?: number
  /** 是否同步生成音频 */
  generateAudio?: boolean
}

export async function submitVideoTask(req: SubmitVideoReq): Promise<{ taskId: string }> {
  return post("/api/ai/video", req)
}

export interface VideoStatusOk {
  ok: boolean
  status: string
  category?: string
  name?: string
  path?: string
  error?: string
}

export async function fetchVideoStatus(taskId: string, apiKey: string, base: string): Promise<VideoStatusOk> {
  const res = await fetch(`/api/ai/video/status?taskId=${encodeURIComponent(taskId)}`, {
    headers: { "x-ai-key": apiKey, "x-ai-base": base },
  })
  const data = (await res.json().catch(() => ({}))) as VideoStatusOk & { error?: string }
  if (!res.ok || !data.ok) throw new Error(data?.error || `状态查询失败 (${res.status})`)
  return data
}

export interface PollResult {
  category: string
  name: string
  path: string
}

/** 轮询视频任务：10s 间隔，最多 60 次（10 分钟上限） */
export async function pollVideoTask(
  taskId: string,
  apiKey: string,
  base: string,
  opts: { interval?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<PollResult> {
  const { interval = 10_000, maxAttempts = 60, signal } = opts
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetchVideoStatus(taskId, apiKey, base)
    if (r.status === "succeeded") {
      if (!r.path || !r.category || !r.name) throw new Error("视频已生成但缺少落盘信息")
      return { category: r.category, name: r.name, path: r.path }
    }
    if (r.status === "failed") throw new Error(r.error || "视频生成失败")
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, interval)
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t)
          reject(new Error("已取消"))
        },
        { once: true },
      )
    })
  }
  throw new Error("视频生成超时（10 分钟），请稍后在资源库确认或重试")
}
