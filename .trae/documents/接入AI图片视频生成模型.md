# 接入真实 AI 图片/视频生成模型

## Context（背景）

当前「无限画布」应用的 AI 生成是**假实现**：图片用 canvas 画占位渐变图（`generatePlaceholderImage`），视频/音频保存 1 字节占位文件，AI 面板显示的模型名 `Gemini 3.1 Flash Lite` 只是硬编码文案（[CanvasNode.tsx L17](file:///d:/infinite-canvas/src/components/canvas/CanvasNode.tsx)），注释明确写着"真实 AI 接入后替换"。

本次改造接入真实模型：
- **视频**：Seedance 2.0 / 2.5（火山方舟 ARK，任务式异步生成：提交 → 轮询 → 下载落盘）
- **图片**：Gemini（`gemini-2.5-flash-image`）、OpenAI（`gpt-image-1`）

用户已确认的决策：
1. API Key 在**应用内设置面板**配置，存 localStorage（`vibex.canvas.ai`）
2. Seedance 模型 ID 用默认值（2.0=`doubao-seedance-2-0-260128`），2.5 给命名规律推测值，**设置面板可编辑**兜底
3. 本地 Vite 中间件代理调用上游，规避 OpenAI 浏览器 CORS；Key 不暴露给浏览器外部

## 实现方案

### 新增文件

#### 1. `d:\infinite-canvas\aiServerPlugin.ts`（核心，Node-only 中间件）
仿 [vite.config.ts 的 assetLibraryPlugin](file:///d:/infinite-canvas/vite.config.ts#L137-L288) 模式，用 Node 原生 `fetch`。三个路由（注意 `/api/ai/video` 前缀会吞 `/api/ai/video/status`，需单挂载点内部按 `pathname + method` 分流）：

- **POST `/api/ai/image`**：body `{provider, model, prompt, apiKey}`
  - `gemini` → `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`，header `x-goog-api-key`，body `{contents:[{parts:[{text:prompt}]}], generationConfig:{responseModalities:["TEXT","IMAGE"]}}`，取 `candidates[0].content.parts[].inlineData.{mimeType,data}` → 返回 `{ok:true, dataUrl:"data:<mime>;base64,<data>"}`
  - `openai` → `POST https://api.openai.com/v1/images/generations`，`Authorization: Bearer`，body `{model, prompt, size:"1024x1024", n:1, response_format:"b64_json"}`，取 `data[0].b64_json` → 返回 `{ok:true, dataUrl}`
  - 超时 120s；上游错误统一取 `data.error.message` 透传
- **POST `/api/ai/video`**：body `{model, prompt, apiKey, base}` → `POST {base}/contents/generations/tasks`（body `{model, content:[{type:"text",text:prompt}]}`，`Bearer` 鉴权）→ 立即返回 `{ok:true, taskId}`。`base` 默认 `https://ark.cn-beijing.volces.com/api/v3`
- **GET `/api/ai/video/status?taskId=`**：Key 用自定义 header `x-ai-key` / `x-ai-base` 传（避免进 Vite 日志）→ `GET {base}/contents/generations/tasks/{taskId}`：
  - `pending` → `{ok:true, status:"pending"}`
  - `failed` → `{ok:true, status:"failed", error}`
  - `succeeded` → 下载 `content.video_url`（超时 120s），写入 `<cwd>/output/assets/视频/seedance-<taskId>.mp4`（文件名按 taskId 幂等去重，已存在跳过下载），返回 `{ok:true, status:"succeeded", category:"视频", name, path:"/api/asset?category=视频&name=...&root=..."}`；下载失败返回 `{ok:false, status:"succeeded", error}` 不落盘，客户端轮询重试

body 解析用手动 chunk 累积（仿 save-asset），错误统一 4xx/5xx JSON `{ok:false, error}`。

#### 2. `d:\infinite-canvas\src\lib\aiModels.ts`
模型注册表：
```ts
export type AiProvider = "gemini" | "openai" | "seedance"
export interface AiModel { id: string; label: string; provider: AiProvider; kind: "image"|"video"; defaultModelId: string; help?: string }
export const IMAGE_MODELS: AiModel[] = [
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "gemini", kind: "image", defaultModelId: "gemini-2.5-flash-image" },
  { id: "gpt-image-1", label: "OpenAI gpt-image-1", provider: "openai", kind: "image", defaultModelId: "gpt-image-1" },
]
export const VIDEO_MODELS: AiModel[] = [
  { id: "seedance-2.0", label: "Seedance 2.0", provider: "seedance", kind: "video", defaultModelId: "doubao-seedance-2-0-260128" },
  { id: "seedance-2.5", label: "Seedance 2.5", provider: "seedance", kind: "video", defaultModelId: "doubao-seedance-2-5-260825", help: "默认 ID 为推测值，可在设置面板修改" },
]
// modelsForKind(kind) / getModelById(id) / getModelId(model, overrides) / PROVIDER_LABEL
```

#### 3. `d:\infinite-canvas\src\lib\aiSettings.ts`
仿 [src/lib/paths.ts](file:///d:/infinite-canvas/src/lib/paths.ts) 的 `usePaths`：`AiSettings = { apiKeys:{gemini,openai,seedance}, baseUrl, modelIds:Record<string,string> }`，localStorage 键 `vibex.canvas.ai`。导出 `useAiSettings()`（含 `storage` 事件跨标签同步）、`getAiSettings()`、`saveAiSettings()`。

#### 4. `d:\infinite-canvas\src\lib\aiClient.ts`
浏览器侧封装：`generateImage()`（POST /api/ai/image）、`submitVideoTask()`、`fetchVideoStatus()`（header 传 key）、`pollVideoTask()`（10s 间隔，最多 60 次 = 10 分钟，支持 AbortSignal）。

### 修改文件

#### 5. `d:\infinite-canvas\src\components\canvas\CanvasNode.tsx`
- 删 L17 `MODEL_NAME` 常量；新增 imports（aiModels/aiSettings/aiClient/sonner toast、ui/select）
- Props 加 `ai: AiSettings`
- 新增状态：`modelKey`（默认取节点类型对应模型列表第一个）、`model = getModelById(modelKey)`
- **L585 面板可见性条件**加排除 `node.kind === "audio"`（音频无生成模型，避免死 UI）
- 折叠按钮文案 L595 → `model?.label`
- 展开面板 L632-638：模型名行替换为 Radix `Select`（[ui/select.tsx](file:///d:/infinite-canvas/src/components/ui/select.tsx)）：视频节点显示 VIDEO_MODELS，其余显示 IMAGE_MODELS
- **生成逻辑 L654-669** 重写：
  1. 无对应 provider 的 API Key → `toast.error("请先在设置中填写 X API Key")`，不发请求（删除假占位图路径）
  2. 图片 → `generateImage` → 复用现有 [saveAsset](file:///d:/infinite-canvas/src/components/canvas/CanvasNode.tsx#L249-L263) → `onImageUpload(node.id, saved.path)` + `onAssetSaved`
  3. 视频 → `submitVideoTask` → `pollVideoTask`（按钮文案"生成中…（可能需几分钟）"）→ 直接把服务端返回的 `path/category/name` 给 `onImageUpload` + `onAssetSaved`（服务端已落盘，不重复保存）
  4. 错误统一 `toast.error`
- `generatePlaceholderImage`（L218-241）删除

#### 6. `d:\infinite-canvas\src\components\canvas\SettingsPanel.tsx`
Props 加 `ai` / `onAiUpdate(section,key,value)` / `onAiReset`。在路径区后新增「模型设置」区块：
- 3 个 API Key 输入（`type="password"`、`autoComplete="off"`）：Gemini / OpenAI / Seedance（火山方舟）
- 方舟 Base URL 输入（默认 `https://ark.cn-beijing.volces.com/api/v3`）
- 每个模型（IMAGE_MODELS + VIDEO_MODELS 循环）的上游模型 ID 输入，placeholder 显示 defaultModelId，空串 = 用默认
- 「恢复默认」按钮（仅重置 AI 设置）；区块说明文案"API Key 仅存本地浏览器，经本地代理转发给对应 AI 服务商"

#### 7. `d:\infinite-canvas\src\pages\Canvas\CanvasPage.tsx`
- 调 `useAiSettings()` 一次（**不得在 CanvasNode 内各自调用**，否则设置面板改动不刷新已挂载节点）
- L137-168 CanvasNode 传 `ai={ai}`；`onAssetSaved` 从 no-op 改为 `setAssetRefreshKey(k=>k+1)`
- L307-313 SettingsPanel 传 `ai/onAiUpdate/onAiReset`
- L324 AssetLibraryPanel 传 `refreshKey`

#### 8. `d:\infinite-canvas\src\components\canvas\AssetLibraryPanel.tsx`
Props 加 `refreshKey?: number`，把加载 useEffect 依赖改为 `[open, assetRoot, refreshKey]`，实现面板打开时生成新资产自动刷新。

#### 9. `d:\infinite-canvas\src\App.tsx`
挂 sonner：`<Toaster position="top-center" richColors />`。

#### 10. 两个 vite 配置 + tsconfig
- `vite.config.ts`：`import { aiServerPlugin } from "./aiServerPlugin"`，加入 plugins 数组
- `vibex-local/vite.local.config.ts`：`import { aiServerPlugin } from "../aiServerPlugin"`，加入 plugins（否则 start-windows 环境 AI 接口不可用）
- `tsconfig.node.json`：include 加 `"aiServerPlugin.ts"`、`"vibex-local/vite.local.config.ts"`（该插件用 node API，不能放 src/ 下，否则破坏 app 工程类型检查）

## 前后端契约摘要

| 接口 | 请求 | 成功响应 | 失败 |
|---|---|---|---|
| POST /api/ai/image | `{provider, model, prompt, apiKey}` | `{ok:true, dataUrl}` | `{ok:false, error}` |
| POST /api/ai/video | `{model, prompt, apiKey, base}` | `{ok:true, taskId}` | `{ok:false, error}` |
| GET /api/ai/video/status?taskId= | header `x-ai-key`,`x-ai-base` | pending / `{ok:true,status:"succeeded",category,name,path}` / `{ok:true,status:"failed",error}` | `{ok:false, error}` |

## 风险与取舍
- OpenAI 不能浏览器直连（CORS）→ 已走本地代理；`vite preview` 不跑 `configureServer`，AI 接口仅 dev 可用（与现有 save-asset 一致）
- 视频大文件用 `arrayBuffer()` 全量入内存，几十 MB 可接受；下载失败不落盘可轮询重试
- Key 明文存 localStorage：本地个人工具可接受，面板文案提醒
- Seedance 2.5 默认 ID 是推测值，已做成可编辑兜底
- 轮询无服务端状态存储：刷新页面丢失进行中任务进度（首版接受，任务完成仍会落盘）

## 验证清单
1. `npx tsc -b` 通过（重点：aiServerPlugin.ts 走 node 工程检查、src 下无 node 依赖）
2. `npm run build` 通过
3. `npm run dev` 后：
   - `curl -X POST localhost:8000/api/ai/image` 带空 apiKey → 400 清晰报错；带假 Key → 502 透传上游鉴权错误（证明链路通）
   - 带真 Key → 200 dataUrl
   - 视频：POST 得 taskId → `curl -H "x-ai-key: <key>" "localhost:8000/api/ai/video/status?taskId=<id>"` 轮询到 succeeded 后 `output/assets/视频/seedance-<id>.mp4` 存在且 /api/asset 可访问
4. 用 start-windows.ps1（vibex-local config）再验证一遍 AI 接口可用（最容易漏的点）
5. 页面：图片节点面板显示 Gemini/OpenAI 下拉、视频节点显示 Seedance 下拉、音频节点不显示面板；设置面板填入 Key 刷新后仍在；生成图片后节点显示真图；生成视频后 `<video>` 可播放（[CanvasNode.tsx L505-511](file:///d:/infinite-canvas/src/components/canvas/CanvasNode.tsx#L505-L511) 已是 video 渲染，无需改）
6. ESLint 预存 1489 errors 与本次改动无关，不改

## VibeX Roundtrip 打包注意
`aiServerPlugin.ts`、`vibex-local/*`、`tsconfig.node.json` 在 `src/` 之外，若走 `app/src/` 目标打包会漏掉根目录级改动；需额外用 `app/` 目标 ZIP 带上（见 `.vibex/skills/vibex-app-source-roundtrip/SKILL.md`，打包前确认 export-manifest 的 app_id）。
