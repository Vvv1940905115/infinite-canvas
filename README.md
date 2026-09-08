# 无限画布工作台 — 本地安装与运行最详细教程

<img width="1917" height="1015" alt="2223" src="https://github.com/user-attachments/assets/74902736-49cb-4977-8576-b30d6adbf64d" />

> 本文档面向**第一次在本机搭建项目**的开发者，按从上到下的顺序一步步操作即可跑起来。
> 每一步都给出了「做什么 / 输入什么命令 / 预期看到什么」。

---

## 〇、先了解：这个项目是什么

这是无限画布（Infinite Canvas）** Web 应用，类似 Miro / Figma 的可视化协作画布：支持节点拖拽、节点间连线、无限缩放、图片素材管理等。

**重要事实（本机已核对）**：当前 `src/` 源代码里**已没有任何后端数据库（PocketBase）调用**，所以这是一个**纯前端应用**，本地不需要启动后端即可完整使用全部画布功能。下文所有"含 PocketBase"的步骤都是**可选**的，日常开发用纯前端方式即可。

**当前核心功能一览：**
- **画布编排**：节点拖拽 / 连线 / 框选 / 无限缩放 / 复制粘贴 / 撤销重做；支持文本、图片、视频、音频、角色、场景、分镜格子、视频合成、快捷剪辑等节点类型。
- **节点内 AI 生成**（无需独立后端，由本地 Vite 开发服务器内置代理转发 AI 请求，规避浏览器跨域限制）：
  - 文本节点：文案 / 歌词生成（Gemini、OpenAI）
  - 图片节点：文生图、参考图生图（Gemini 2.5 Flash Image、OpenAI gpt-image-1）
  - 视频节点：Seedance 2.0 / 2.5 文生视频（火山方舟，异步任务 + 轮询，产物自动下载落盘到资源库「视频」文件夹）；AI 面板提供「文生视频 / 首帧 / 首尾帧 / 视频编辑 / 视频延长 / 全能参考」六种模式，会随当前接入素材实时判断可用并自动切换
  - 音频节点：MiniMax 语音合成 / 音乐生成（需额外填 GroupId）
- **模型设置**：画布右上角齿轮图标 →「设置 → 模型设置」，按厂商填写 API Key 并可覆盖上游模型 ID；密钥只存在浏览器 `localStorage`，经本地代理转发给对应服务商，不会写入仓库。

---

## 一、系统与环境要求（先看这里，避免踩坑）

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| **Node.js** | 20.19+ 或 22.12+ | 低于此版本启动会直接报错 |
| **npm** | 任意较新版本 | 本机已装 `npm 11.16.0` ✅ |
| **pnpm**（可选） | 最新 | 推荐，但**本机当前未预装**，可用 npm 代替 |
| **Git**（可选） | — | 仅需要版本管理时用 |
| 网络 | 需要联网 | 仅首次 `install` 下载依赖时需要 |

**本机实测环境（2026-08-18 核对）：**
```
node --version  →  v24.18.0   ✅ 满足要求
npm  --version  →  v11.16.0   ✅
pnpm            →  未安装（用 npm 或 node 直启即可）
```

### 操作系统
- **Windows**：自带 PowerShell 5+（Windows 10/11 自带），直接用即可
- **macOS**：需 `curl`、`unzip`（系统自带）
- **Linux**：需手动安装 `curl`、`unzip`

---

## 二、第一步：安装 Node.js（如果还没装）

> 如果 `node --version` 已经显示 `v20.19+` 或 `v22.12+`，**跳过本节**。

1. 打开浏览器访问 <https://nodejs.org/>
2. 下载 **LTS（长期支持）** 版本，推荐 **22.x**
3. 双击安装包，一路下一步（勾选 "Add to PATH"）
4. 安装完成后，**重新打开**一个 PowerShell / 终端，验证：
   ```powershell
   node --version
   npm --version
   ```
   - 正常应显示版本号（如 `v24.18.0` / `11.16.0`）
   - 若提示"不是内部或外部命令"，说明 PATH 没配好，重启终端或重装 Node 并勾选 Add to PATH

> 💡 推荐用版本管理器：Windows 用 [nvm-windows](https://github.com/coreybutler/nvm-windows)，macOS/Linux 用 [nvm](https://github.com/nvm-sh/nvm)，方便切换 Node 版本。

---

## 三、第二步：准备项目代码

你已经有了项目目录 `d:\infinite-canvas`（即本仓库）。如果是从别处拷贝/下载：

```powershell
# 进入项目根目录（请改成你自己的实际路径）
cd d:\infinite-canvas

# 确认目录里有这些关键文件
ls
# 应能看到：package.json  vite.config.ts  src\  node_modules\（装完依赖后才有） 等
```

> ⚠️ **不要删除** `.vibex/` 和 `vibex-local/` 目录，它们包含 VibeX 平台集成与本地启动脚本。

---

## 四、第三步：安装依赖（关键一步）

项目依赖必须安装一次，之后启动就不用再装。

### 方式 A：用 npm（最简单，本机推荐）⭐

```powershell
cd d:\infinite-canvas
npm install
```

- 首次运行会下载几百个包，耗时几十秒到几分钟（取决于网速）
- 看到进度条走完、没红色报错即成功
- 成功后目录里会多出 `node_modules/` 文件夹

### 方式 B：用 pnpm（如果环境支持）

如果本机没装 pnpm，可先用 corepack 启用（Node 自带）：

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version        # 确认能显示版本
pnpm install
```

> ⚠️ **沙箱/受限终端提示**：某些受限环境里 `pnpm install` 会报
> `ERR_PNPM_SANDBOX ... global store ... permission denied` 或长时间卡住。
> 此时**直接改用方式 A（npm）**即可，不是项目问题。

### 方式 C：网络慢？换国内镜像

```powershell
npm config set registry https://registry.npmmirror.com
npm install
```

### 安装失败怎么办
- 红色报错里有 `EACCES` / 权限问题 → 用管理员身份运行终端，或改用 npm
- 卡在 `fetch` → 检查网络 / 换镜像（见上）
- 删除 `node_modules` 和 `package-lock.json` 后重试：`rm -r node_modules; npm install`

---

## 五、第四步：配置环境变量（一行命令）

前端纯运行时**其实不需要任何环境变量**也能跑。但为了和 VibeX 在线环境保持一致，建议创建 `.env.local`：

```powershell
# Windows PowerShell
Copy-Item vibex-local\.env.local.example .env.local

# macOS / Linux
cp vibex-local/.env.local.example .env.local
```

文件内容（`vibex-local/.env.local.example` 已预填）：
```env
# Optional local-only secrets. Do not commit real keys.
VIBEX_APP_ID=app-5a0d04f9ad6a4192bc6313684dba8b34
```

> `.env.local` 已加入 `.gitignore`，不会提交到仓库，可放心保留。

> 💡 **AI 的 API Key 不需要写进 `.env.local`**。打开应用后，点画布右上角齿轮图标 →「设置 → 模型设置」，按厂商填入即可（只存浏览器本地）。`.env.local` 里的 `VIBEX_APP_ID` 仅用于与 VibeX 在线环境保持一致。

---

## 六、第五步：启动开发服务器（三种方式任选）

依赖装好后，选下面**任意一种**方式启动即可。

### 方式 1：PowerShell 直接启动（最稳，绕过 pnpm）⭐

```powershell
cd d:\infinite-canvas
node node_modules/vite/bin/vite.js
```

启动后终端会输出类似：
```
  VITE v8.x  ready in xxx ms
  ➜  Local:   http://127.0.0.1:8000/
```

### 方式 2：npm 脚本启动

```powershell
cd d:\infinite-canvas
npm run dev
# 等价命令：npm exec vite
```

### 方式 3：pnpm 脚本启动（装了 pnpm 时）

```powershell
pnpm dev
```

> 三种方式最终都是启动 Vite，监听 **http://127.0.0.1:8000**，端口固定为 8000（`strictPort: true`，被占用会报错）。

---

## 七、第六步：打开浏览器验证

启动成功后，在浏览器地址栏输入：

```
http://127.0.0.1:8000
```

你应该看到：
1. 左上角显示「**画布工作台**」标签
2. 画布中央提示「画布空了，点左上角的圆形 + 按钮添加第一个节点」
3. 左下角显示当前缩放比例和节点数量
4. 可以正常：
   - 点左上角圆形 **+** 按钮添加节点
   - 拖拽节点移动
   - 滚轮缩放 / 空格拖动画布
   - 选中节点后，从左右两侧圆形锚点拖出连线
   - **双击/单击节点顶部标题**（角色、场景节点）修改名称

> 如果页面空白：按 `F12` 打开控制台看报错；多数是端口被占用或依赖没装全。

---

## 八、端口被占用怎么办

如果启动报错 `Port 8000 is already in use`：

```powershell
# 查找占用 8000 端口的进程
netstat -ano | findstr :8000

# 结束它（把 <PID> 换成上一步查到的数字）
taskkill /PID <PID> /F
```

macOS / Linux：
```bash
lsof -i :8000
kill -9 <PID>
```

然后重新执行启动命令。

---

## 九、项目结构速览（知道改哪里）

```
d:\infinite-canvas\
├── src\
│   ├── components\canvas\
│   │   ├── CanvasNode.tsx       # 画布节点：标题编辑、锚点连线、底部 AI 生成面板（含视频节点六种模式 Tab）
│   │   ├── EdgesLayer.tsx       # 连线层（虚线箭头渲染）
│   │   ├── AddMenu.tsx          # 添加节点菜单
│   │   ├── CanvasToolbar.tsx    # 顶部工具栏
│   │   ├── SettingsPanel.tsx    # 设置侧栏：路径设置 + 模型设置（API Key / 模型 ID 覆盖）
│   │   ├── AssetLibraryPanel.tsx # 资源库面板（浏览 / 上传素材）
│   │   └── nodeTypes.ts         # 节点类型定义
│   ├── pages\Canvas\
│   │   ├── CanvasPage.tsx       # 画布页面
│   │   ├── index.tsx            # 页面入口
│   │   └── useCanvas.ts         # 画布状态管理（连线 / 素材流 / 历史记录）
│   ├── lib\
│   │   ├── aiClient.ts          # AI 请求封装（调本地代理 /api/ai/...）
│   │   ├── aiModels.ts          # 厂商与模型注册表（图片/视频/音频/文本）
│   │   └── aiSettings.ts        # AI 设置读写（localStorage + 跨标签同步）
│   ├── App.tsx / main.tsx       # 应用根
│   └── index.css                # 全局样式
├── aiServerPlugin.ts           # Vite dev 代理：/api/ai/... 转发 Gemini/OpenAI/火山方舟/MiniMax，视频生成后落盘
├── assetLibraryPlugin.ts       # 资源库静态服务（/api/asset）
├── vibex-local\                 # 本地启动脚本 + 配置（勿改平台集成部分）
├── vite.config.ts              # Vite 配置（含 VibeX 集成，勿删 rhSourcePlugin）
├── package.json                # 依赖与脚本
└── README.md                   # 本文档
```

---

## 十、常用命令速查

```powershell
# 安装依赖
npm install

# 启动（任选其一）
node node_modules/vite/bin/vite.js     # 方式1：最稳
npm run dev                            # 方式2
pnpm dev                               # 方式3（需装 pnpm）

# 代码规范检查
npm run lint

# 类型检查 + 生产构建
npm run build

# 预览生产构建
npm run preview
```

---

## 十一、关于 PocketBase（后端，纯前端可完全忽略）

只有当你想**完整复刻 VibeX 在线环境（含后端数据库）**时才需要 PocketBase。日常画布开发**不需要**。

- 端口：7000（`http://127.0.0.1:7000`）
- 一键完整启动（会顺带下载并启动 PocketBase）：
  - Windows：双击 `vibex-local\start-windows.bat`
  - macOS/Linux：`./vibex-local/start-macos.sh`（先 `chmod +x`）
- 手动下载地址：<https://github.com/pocketbase/pocketbase/releases/latest>
- 健康检查：访问 `http://127.0.0.1:7000/api/health` 应返回 `{"message":"API is healthy.","code":200}`

> 纯前端方式下，PocketBase 的 7000 端口**完全不用开**，不要被目录里的 `pocketbase/` 文件夹迷惑。

---

## 十二、把本地修改回传到 VibeX 平台

本地改完代码后，需要打包成 ZIP 回传到 VibeX Source 编辑器：

```powershell
python3 .vibex/skills/vibex-app-source-roundtrip/scripts/package_vibex_upload.py `
  --source ./src `
  --output ../app-src-vibex-upload.zip `
  --target app/src `
  --include index.css `
  --include components/canvas
```

注意：
1. ZIP 内路径**不要带外层文件夹**（如 `infinite-canvas/src/...`），否则写入错误路径
2. 不要打包 `.env`、`pb_data`、`node_modules`、`dist`、日志文件
3. 不要改 VibeX 平台库文件（如 `vite.config.ts` 里的 `rhSourcePlugin()`）
4. 详细规则见 `.vibex/skills/vibex-app-source-roundtrip/SKILL.md`

---

## 十三、常见问题（FAQ）

**Q1：启动报 `Node.js 20.19+ or 22.12+ is required`**
→ 升级 Node.js 到 20.19+ / 22.12+，用 nvm 切换最方便。

**Q2：pnpm 报 sandbox / 全局 store 权限错误**
→ 别用 pnpm，直接用 `node node_modules/vite/bin/vite.js` 或 `npm run dev`。

**Q3：页面空白 / 控制台报错**
→ 确认依赖装全了（`node_modules` 存在）；确认用的是 `http://127.0.0.1:8000`；按 F12 看具体报错。

**Q4：端口被占用**
→ 见第八节，找到并结束占用 8000 的进程。

**Q5：PowerShell 提示"禁止运行脚本"**
→ 用 `.bat` 双击启动，或以管理员运行 `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`。

**Q6：连不上 PocketBase / 7000 端口**
→ 纯前端不需要它，忽略即可；只有用一键完整启动脚本才会拉起。

**Q7：AI 生成报错 / 401 / 一直转圈**
→ 先确认：① 在右上角齿轮「设置 → 模型设置」里对应厂商的 API Key 已填写（MiniMax 还要填 GroupId；Seedance 可在此修改火山方舟 base URL）；② 页面是通过 `npm run dev` 启动的 Vite 服务访问的——AI 请求走本地代理（`aiServerPlugin.ts`），直接双击 HTML 或跨域名访问会因 CORS 失败。视频是异步任务，最长约轮询 10 分钟，期间请保持页面打开。

---

## 十四、一句话总结

> 装好 Node 20.19+ → `npm install` → `node node_modules/vite/bin/vite.js` → 浏览器开 `http://127.0.0.1:8000`，完事。

有任何问题先看本文「十三、FAQ」，或检查终端报错信息。

---

## 十五、AI 生成能力使用指引

### 1. 前置：一定要用 Vite 服务打开页面
AI 请求由 `aiServerPlugin.ts` 在本地 Vite 开发服务器内代理（`/api/ai/image`、`/api/ai/video`、`/api/ai/tts`、`/api/ai/text`），所以必须按本文第六节方式启动后访问 **http://127.0.0.1:8000**，不要直接双击 `index.html`。

### 2. 配置各厂商密钥（一次性）
点画布**右上角齿轮图标** →「设置」：
- **路径设置（可选）**：可自定义「资源库路径」，AI 生成的图片 / 视频 / 音频会按「图片 / 视频 / 音频」子目录保存到这里（默认 `output/assets`）；「画布自动保存路径」用于画布变更后自动导出 JSON。
- **模型设置（必填）**：按厂商分组填写：
  - **Gemini（谷歌）**：图片 / 文本生成用，填 Google AI Studio 的 API Key（`AIza...`）
  - **OpenAI**：图片 / 文本生成用，填平台 API Key
  - **Seedance（字节 · 火山方舟）**：视频生成用，填方舟 `ARK_API_KEY`；base URL 默认 `https://ark.cn-beijing.volces.com/api/v3`，可按需修改
  - **MiniMax**：语音合成 / 音乐生成用，需要 **API Key + GroupId** 两项

密钥只保存在本机浏览器（`localStorage`），不会写入项目文件，请勿在共享电脑上使用；「恢复默认」可一键清空。

> 若某个模型默认 ID 不是方舟 / MiniMax 控制台里的实际值（例如 Seedance 2.5），会调用失败——到「模型设置」里把该模型对应的上游模型 ID 覆盖为控制台真实 ID 即可，改完立即生效。

### 3. 开始生成
1. 点左上角圆形 **+** 添加节点：文本 / 图片 / 视频 / 音频 等。
2. 选中节点，底部出现 AI 生成区：输入描述 → 选择模型（同一类型可切换模型）→ 点右侧生成按钮。
3. **图片节点**：可先上传参考图或从画布选择图片节点接入，做参考图生图。
4. **视频节点**：面板上方有六个模式 Tab——**全能参考 / 视频编辑 / 文生视频 / 首帧 / 首尾帧 / 视频延长**：
   - 可用性由**当前接入素材**实时决定（连线接入的图片 / 视频、手动追加的输入素材都会被统计），不满足条件的 Tab 置灰且不可点，鼠标悬停可看到原因；
   - 素材变化时自动选中与素材最匹配的 Tab：纯文字→文生视频；1 张图→首帧；2 张图→首尾帧；≥3 张图→全能参考；图片+视频混合→全能参考；纯视频→视频编辑；
   - 一旦手动点选可用 Tab，就不再被自动切换。
5. 生成结果会保存到资源库路径并显示在节点上，可直接删除 / 替换 / 连线复用。

### 4. 生成产物去哪了
- 图片：客户端保存到资源库「图片」文件夹，节点内直接展示。
- 视频：任务完成后由本地代理把视频下载到资源库「视频」文件夹（默认 `output/assets/视频`），节点内可播放预览。
- 音频：返回音频并保存到资源库「音频」文件夹。
