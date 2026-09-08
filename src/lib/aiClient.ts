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
}

export async function generateImage(req: GenerateImageReq): Promise<{ dataUrl: string }> {
  return post("/api/ai/image", req)
}

export interface SubmitVideoReq {
  model: string
  prompt: string
  apiKey: string
  base: string
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
