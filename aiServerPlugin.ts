import fs from "node:fs"
import path from "node:path"

// AI 生成代理中间件：本地 Vite dev server 调用上游 AI 服务商，规避浏览器 CORS。
// 图片（Gemini / OpenAI）同步返回；视频（Seedance/火山方舟）任务式异步：
// 提交任务 → 轮询状态 → 成功后在服务端下载视频落盘到资源库。

const ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com/api/v3"
const MINIMAX_DEFAULT_BASE = "https://api.minimax.chat/v1"
const VIDEO_DIR = "视频"
const ASSET_ROOT_DEFAULT = path.resolve(process.cwd(), "output/assets")

/** 手动累积读取 JSON body（仿 vite.config.ts 里 save-asset 的写法） */
function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on("error", reject)
  })
}

function sendJson(res: any, status: number, obj: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(obj))
}

/** 从各上游错误体提取可读 message：gemini/openai/ark 都是 {error:{message}} 形态 */
function upstreamError(data: any, fallback: string): string {
  return data?.error?.message || fallback
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, data }
}

export function aiServerPlugin() {
  return {
    name: "ai-server",
    configureServer(server: any) {
      // 单挂载点 + 内部按 pathname/method 分流：
      // "/api/ai/video" 前缀会匹配 "/api/ai/video/status"，必须内部分流。
      server.middlewares.use("/api/ai/video", async (req: any, res: any, next: any) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
        console.log("[ai-debug] video mw:", req.method, JSON.stringify(req.url), "pathname:", url.pathname)

        // ---- POST /api/ai/video：提交视频生成任务，立即返回 taskId ----
        // 注意：connect 的 use("/api/ai/video", ...) 会剥离挂载前缀，
        // 因此 POST /api/ai/video 到这里时 pathname 是 "/"。
        if (url.pathname === "/" && req.method === "POST") {
          let body: any
          try {
            body = await readJsonBody(req)
          } catch {
            return sendJson(res, 400, { ok: false, error: "invalid JSON body" })
          }
          const { model, prompt, apiKey } = body
          const base = (body.base || ARK_DEFAULT_BASE).replace(/\/+$/, "")
          if (!model || !prompt?.trim() || !apiKey?.trim()) {
            return sendJson(res, 400, { ok: false, error: "缺少 model/prompt/apiKey" })
          }
          try {
            const { data } = await fetchJson(`${base}/contents/generations/tasks`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ model, content: [{ type: "text", text: prompt }] }),
              signal: AbortSignal.timeout(30_000),
            })
            const taskId = data?.id
            if (!taskId) {
              return sendJson(res, 400, {
                ok: false,
                error: upstreamError(data, "上游未返回 taskId"),
              })
            }
            return sendJson(res, 200, { ok: true, taskId })
          } catch (err: any) {
            return sendJson(res, 502, { ok: false, error: err?.message || "提交任务失败" })
          }
        }

        // ---- GET /api/ai/video/status?taskId=...：查状态；succeeded 时下载落盘 ----
        if (url.pathname === "/status" && req.method === "GET") {
          const taskId = url.searchParams.get("taskId") || ""
          // Key 用 header 传，避免进 Vite dev server 请求日志
          const apiKey = (req.headers["x-ai-key"] as string) || ""
          const base = ((req.headers["x-ai-base"] as string) || ARK_DEFAULT_BASE).replace(/\/+$/, "")
          if (!taskId || !apiKey) {
            return sendJson(res, 400, { ok: false, error: "缺少 taskId/apiKey" })
          }
          try {
            const { data } = await fetchJson(
              `${base}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
              {
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(30_000),
              },
            )
            const s = data?.status
            if (s === "succeeded") {
              const videoUrl = data?.content?.video_url
              if (!videoUrl) {
                return sendJson(res, 502, { ok: false, status: "succeeded", error: "上游成功但缺少 video_url" })
              }
              const dir = path.join(ASSET_ROOT_DEFAULT, VIDEO_DIR)
              fs.mkdirSync(dir, { recursive: true })
              // 以 taskId 命名天然去重：已存在则跳过下载，轮询/重试幂等
              const name = `seedance-${taskId.replace(/[\\/:*?"<>|]/g, "_")}.mp4`
              const filePath = path.join(dir, name)
              if (!fs.existsSync(filePath)) {
                try {
                  const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) })
                  if (!dl.ok) throw new Error(`下载视频失败 HTTP ${dl.status}`)
                  fs.writeFileSync(filePath, Buffer.from(await dl.arrayBuffer()))
                } catch (err: any) {
                  // 不落盘，客户端下一轮轮询可重试
                  return sendJson(res, 502, {
                    ok: false,
                    status: "succeeded",
                    error: `视频下载失败: ${err?.message || err}`,
                  })
                }
              }
              const assetPath = `/api/asset?category=${encodeURIComponent(VIDEO_DIR)}&name=${encodeURIComponent(name)}&root=${encodeURIComponent(ASSET_ROOT_DEFAULT)}`
              return sendJson(res, 200, { ok: true, status: "succeeded", category: VIDEO_DIR, name, path: assetPath })
            }
            if (s === "failed") {
              return sendJson(res, 200, { ok: true, status: "failed", error: upstreamError(data, "视频生成失败") })
            }
            return sendJson(res, 200, { ok: true, status: s || "pending" })
          } catch (err: any) {
            return sendJson(res, 502, { ok: false, error: err?.message || "查询任务失败" })
          }
        }
        return next()
      })

      // ---- POST /api/ai/tts：MiniMax 文字转语音 / 音乐生成，同步返回音频 dataUrl ----
      // MiniMax t2a_v2 / music_generation 返回 data.audio 为 hex 编码，需转 base64 data URL。
      server.middlewares.use("/api/ai/tts", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next()
        let body: any
        try {
          body = await readJsonBody(req)
        } catch {
          return sendJson(res, 400, { ok: false, error: "invalid JSON body" })
        }
        const { model, task, text, voice, apiKey, groupId } = body
        const base = (body.base || MINIMAX_DEFAULT_BASE).replace(/\/+$/, "")
        if (!model || !text?.trim() || !apiKey?.trim() || !groupId?.trim()) {
          return sendJson(res, 400, { ok: false, error: "缺少 model/text/apiKey/groupId" })
        }
        const url =
          task === "music"
            ? `${base}/music_generation?GroupId=${encodeURIComponent(groupId)}`
            : `${base}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`
        const payload =
          task === "music"
            ? { model, prompt: text }
            : {
                model,
                text,
                stream: false,
                voice_setting: { voice_id: voice || "female-chengshu", speed: 1, vol: 1, pitch: 0 },
                audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
              }
        try {
          const { status, data } = await fetchJson(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(120_000),
          })
          const audioHex: string | undefined = data?.data?.audio || data?.audio
          if (!audioHex) {
            const msg = data?.base_resp?.status_msg || upstreamError(data, "上游未返回音频")
            return sendJson(res, status >= 500 ? 502 : 400, { ok: false, error: msg })
          }
          const buf = Buffer.from(audioHex, "hex")
          return sendJson(res, 200, { ok: true, dataUrl: `data:audio/mpeg;base64,${buf.toString("base64")}` })
        } catch (err: any) {
          return sendJson(res, 502, { ok: false, error: err?.message || "语音生成失败" })
        }
      })

      // ---- POST /api/ai/image：同步生成图片，返回 dataUrl ----
      server.middlewares.use("/api/ai/image", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next()
        let body: any
        try {
          body = await readJsonBody(req)
        } catch {
          return sendJson(res, 400, { ok: false, error: "invalid JSON body" })
        }
        const { provider, model, prompt, apiKey } = body
        if (!provider || !model || !prompt?.trim() || !apiKey?.trim()) {
          return sendJson(res, 400, { ok: false, error: "缺少 provider/model/prompt/apiKey" })
        }
        try {
          if (provider === "gemini") {
            const { status, data } = await fetchJson(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
              {
                method: "POST",
                headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
                }),
                signal: AbortSignal.timeout(120_000),
              },
            )
            const parts = data?.candidates?.[0]?.content?.parts
            const inline = Array.isArray(parts) ? parts.find((p: any) => p?.inlineData?.data) : null
            if (!inline) {
              return sendJson(res, status >= 500 ? 502 : 400, {
                ok: false,
                error: upstreamError(data, "上游未返回图片"),
              })
            }
            const { mimeType, data: b64 } = inline.inlineData
            return sendJson(res, 200, { ok: true, dataUrl: `data:${mimeType || "image/png"};base64,${b64}` })
          }
          if (provider === "openai") {
            const { status, data } = await fetchJson("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1, response_format: "b64_json" }),
              signal: AbortSignal.timeout(120_000),
            })
            const b64 = data?.data?.[0]?.b64_json
            if (!b64) {
              return sendJson(res, status >= 500 ? 502 : 400, {
                ok: false,
                error: upstreamError(data, "上游未返回图片"),
              })
            }
            return sendJson(res, 200, { ok: true, dataUrl: `data:image/png;base64,${b64}` })
          }
          return sendJson(res, 400, { ok: false, error: `未知 provider: ${provider}` })
        } catch (err: any) {
          return sendJson(res, 502, { ok: false, error: err?.message || "图片生成失败" })
        }
      })
    },
  }
}
