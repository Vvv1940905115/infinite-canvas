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

function resolveAssetRoot(reqRoot?: string | null): string {
  const normalized = (reqRoot || "").trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (normalized) return path.resolve(normalized)
  return path.resolve(process.cwd(), "output/assets")
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], data: m[2] }
}

function resolveAssetReference(url: string): { mimeType: string; data: string } | null {
  try {
    const u = new URL(url, "http://localhost")
    if (u.pathname !== "/api/asset") return null
    const category = u.searchParams.get("category") || "其他"
    const name = u.searchParams.get("name") || ""
    const root = resolveAssetRoot(u.searchParams.get("root"))
    if (!name) return null
    const filePath = path.join(root, category, name)
    if (!fs.existsSync(filePath)) return null
    const ext = path.extname(filePath).toLowerCase()
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "application/octet-stream"
    return { mimeType, data: fs.readFileSync(filePath).toString("base64") }
  } catch {
    return null
  }
}

function referenceToPart(url: string): { inlineData: { mimeType: string; data: string } } | null {
  const data = parseDataUrl(url)
  if (data) return { inlineData: data }
  const asset = resolveAssetReference(url)
  if (asset) return { inlineData: asset }
  return null
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
          const {
            model,
            prompt,
            apiKey,
            ratio,
            width,
            height,
            resolution: resParam,
            duration: durParam,
            generateAudio,
          } = body
          const base = (body.base || ARK_DEFAULT_BASE).replace(/\/+$/, "")
          if (!model || !prompt?.trim() || !apiKey?.trim()) {
            return sendJson(res, 400, { ok: false, error: "缺少 model/prompt/apiKey" })
          }
          // 自定义宽高时按最接近的预设比例推导；未指定则自适应
          const effectiveRatio = (() => {
            if (ratio) return ratio
            const w = Number(width) || 0
            const h = Number(height) || 0
            if (!w || !h) return "adaptive"
            const r = w / h
            const list: [string, number][] = [
              ["16:9", 16 / 9],
              ["9:16", 9 / 16],
              ["1:1", 1],
              ["4:3", 4 / 3],
              ["3:4", 3 / 4],
              ["21:9", 21 / 9],
            ]
            let best = list[0]
            for (const it of list) if (Math.abs(it[1] - r) < Math.abs(best[1] - r)) best = it
            return best[0]
          })()
          // 分辨率档位：优先取面板选择，否则按自定义高度推导（Seedance：480p / 720p / 1080p）
          const resolution =
            resParam || (Number(height) >= 1080 ? "1080p" : Number(height) > 0 ? "720p" : "720p")
          // 生成时长：Seedance 取值 4-12 秒整数
          const duration = Math.min(12, Math.max(4, Number(durParam) || 5))
          const audioCmd = typeof generateAudio === "boolean" ? ` --generate_audio ${generateAudio}` : ""
          try {
            const { data } = await fetchJson(`${base}/contents/generations/tasks`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                content: [
                  {
                    type: "text",
                    text: `${prompt} --ratio ${effectiveRatio} --resolution ${resolution} --duration ${duration}${audioCmd}`,
                  },
                ],
              }),
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
        const { provider, model, prompt, apiKey, aspectRatio, width, height, quality, imageRes } = body
        if (!provider || !model || !prompt?.trim() || !apiKey?.trim()) {
          return sendJson(res, 400, { ok: false, error: "缺少 provider/model/prompt/apiKey" })
        }
        // OpenAI 仅接受固定几组尺寸，按方向就近映射；自适应交给模型（auto）
        const openaiSize = (() => {
          const w = Number(width) || 0
          const h = Number(height) || 0
          if (w > 0 && h > 0) return w === h ? "1024x1024" : w > h ? "1536x1024" : "1024x1536"
          if (aspectRatio === "adaptive") return "auto"
          if (aspectRatio === "1:1") return "1024x1024"
          if (aspectRatio === "16:9" || aspectRatio === "4:3") return "1536x1024"
          if (aspectRatio === "9:16" || aspectRatio === "3:4") return "1024x1536"
          return "1024x1024"
        })()
        try {
          if (provider === "gemini") {
            const refParts = ((body.references || []) as string[])
              .map(referenceToPart)
              .filter((p): p is { inlineData: { mimeType: string; data: string } } => p !== null)
            const { status, data } = await fetchJson(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
              {
                method: "POST",
                headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [...refParts, { text: prompt }] }],
                  generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                    ...(aspectRatio && aspectRatio !== "adaptive" || imageRes
                      ? {
                          imageConfig: {
                            ...(aspectRatio && aspectRatio !== "adaptive" ? { aspectRatio } : {}),
                            ...(imageRes ? { imageSize: imageRes.toUpperCase() } : {}),
                          },
                        }
                      : {}),
                  },
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
              body: JSON.stringify({
                model,
                prompt,
                size: openaiSize,
                n: 1,
                response_format: "b64_json",
                ...(quality ? { quality } : {}),
              }),
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

      // ---- POST /api/ai/text：文本 / 歌词生成，同步返回文本 ----
      server.middlewares.use("/api/ai/text", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next()
        let body: any
        try {
          body = await readJsonBody(req)
        } catch {
          return sendJson(res, 400, { ok: false, error: "invalid JSON body" })
        }
        const { provider, model, prompt, task } = body
        const apiKey = body.apiKey?.trim()
        if (!provider || !model || !prompt?.trim() || !apiKey) {
          return sendJson(res, 400, { ok: false, error: "缺少 provider/model/prompt/apiKey" })
        }
        const system =
          task === "lyrics"
            ? "你是一位专业歌词创作者。请根据用户描述创作一段歌词，只输出歌词正文，不要解释、不要加引号或额外说明。"
            : "你是一位专业文案作者。请根据用户描述生成一段文本内容，只输出正文，不要解释、不要加引号或额外说明。"
        try {
          if (provider === "gemini") {
            const { status, data } = await fetchJson(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
              {
                method: "POST",
                headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
                }),
                signal: AbortSignal.timeout(120_000),
              },
            )
            const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.text)?.text
            if (!text) {
              return sendJson(res, status >= 500 ? 502 : 400, {
                ok: false,
                error: upstreamError(data, "上游未返回文本"),
              })
            }
            return sendJson(res, 200, { ok: true, text })
          }
          if (provider === "openai") {
            const { status, data } = await fetchJson("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: prompt },
                ],
              }),
              signal: AbortSignal.timeout(120_000),
            })
            const text = data?.choices?.[0]?.message?.content
            if (!text) {
              return sendJson(res, status >= 500 ? 502 : 400, {
                ok: false,
                error: upstreamError(data, "上游未返回文本"),
              })
            }
            return sendJson(res, 200, { ok: true, text })
          }
          return sendJson(res, 400, { ok: false, error: `未知 provider: ${provider}` })
        } catch (err: any) {
          return sendJson(res, 502, { ok: false, error: err?.message || "文本生成失败" })
        }
      })
    },
  }
}
