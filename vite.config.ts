// Bake 的 vite.config.ts (0.0.7+ runtime). 已经 inline 了 rh-visual-edit 的
// rhSourcePlugin —— 模型不需要再调 rh-visual-edit skill 装它.
//
// ⚠️ 整体 Write 覆盖本文件是禁忌. 改时用 Read + Edit 局部改:
//   - 加 alias / 改 server 配置: 修对应字段
//   - 加别的 plugin: 在 plugins 数组里追加, 但 rhSourcePlugin() 必须在第 0 位 (enforce: 'pre' 保证它在 react/oxc 之前跑)
//   - 不要删 rhSourcePlugin 那段函数定义, 也不要删 @babel/parser / @babel/traverse / magic-string 这三个 import
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { parse as babelParse } from '@babel/parser'
import _traverse from '@babel/traverse'
import MagicString from 'magic-string'
import { aiServerPlugin } from './aiServerPlugin'

// @babel/traverse 在不同 bundler 下 ESM/CJS interop 形态不一致, 兜底取 default.
const traverse = ((_traverse as any).default ?? _traverse) as typeof _traverse

// rh-visual-edit: 独立 Vite plugin, 给每个 JSX 元素加 data-rh-src="<rel>:<line>:<col>".
// 不依赖 @vitejs/plugin-react 的 babel hook (plugin-react v6+ 已切到 oxc, 不再接受 babel 选项).
function rhSourcePlugin() {
  return {
    name: 'rh-source',
    enforce: 'pre' as const,
    apply: 'serve' as const,
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0]
      if (!/\.(jsx|tsx)$/.test(cleanId)) return null
      if (cleanId.includes('/node_modules/')) return null
      let ast: any
      try {
        ast = babelParse(code, {
          sourceType: 'module',
          allowReturnOutsideFunction: true,
          plugins: ['jsx', 'typescript'],
        })
      } catch {
        return null
      }
      const cwd = process.cwd()
      const rel = cleanId.startsWith(cwd + '/') ? cleanId.slice(cwd.length + 1) : cleanId
      const filename = rel.replace(/\\/g, '/')
      const ms = new MagicString(code)
      traverse(ast, {
        JSXOpeningElement(p: any) {
          const node = p.node
          const loc = node.loc
          if (!loc) return
          const exists = node.attributes.some(
            (a: any) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-rh-src',
          )
          if (exists) return
          const nameNode = node.name
          if (!nameNode || nameNode.end == null) return
          // TSX 里 <Foo<T> /> 合法; 必须插在 typeArguments 之后, 否则会变成
          // <Foo data-rh-src="..."<T> /> 导致 oxc/babel 解析失败.
          const insertEnd =
            (node.typeArguments && node.typeArguments.end) ??
            (node.typeParameters && node.typeParameters.end) ??
            nameNode.end
          ms.appendRight(
            insertEnd,
            ` data-rh-src="${filename}:${loc.start.line}:${loc.start.column}"`,
          )
        },
      })
      if (!ms.hasChanged()) return null
      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true, source: id }),
      }
    },
  }
}

/** 点击打开文件夹：由 Vite dev server 调用系统命令打开本地目录。 */
function openFolderPlugin() {
  return {
    name: 'open-folder',
    configureServer(server: any) {
      server.middlewares.use('/api/open-folder', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next()
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const dirPath = url.searchParams.get('path')
        if (!dirPath) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: 'missing path' }))
          return
        }

        const normalized = path.normalize(decodeURIComponent(dirPath))
        if (!fs.existsSync(normalized)) {
          try {
            fs.mkdirSync(normalized, { recursive: true })
          } catch (mkdirErr: any) {
            console.error('[open-folder] mkdir failed:', mkdirErr?.message || mkdirErr)
          }
        }
        const platformCmd =
          process.platform === 'win32'
            ? `explorer "${normalized}"`
            : process.platform === 'darwin'
              ? `open "${normalized}"`
              : `xdg-open "${normalized}"`

        exec(platformCmd, (err) => {
          if (err) {
            console.error('[open-folder] failed:', err.message)
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: err.message }))
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        })
      })
    },
  }
}

const ASSET_CATEGORIES = ['图片', '视频', '音频']
const CATEGORY_EXTS: Record<string, string[]> = {
  图片: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  视频: ['.mp4', '.webm', '.mov', '.avi'],
  音频: ['.mp3', '.wav', '.ogg', '.m4a'],
}

function resolveAssetRoot(reqRoot?: string | null): string {
  const normalized = (reqRoot || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (normalized) return path.resolve(normalized)
  return path.resolve(process.cwd(), 'output/assets')
}

/** 资源库 API：列目录、保存 base64 资源、读取资源文件。 */
function assetLibraryPlugin() {
  return {
    name: 'asset-library',
    configureServer(server: any) {
      server.middlewares.use('/api/list-assets', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next()
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const root = resolveAssetRoot(url.searchParams.get('root'))
        try {
          const assets: { category: string; files: { name: string; path: string; mtime: number }[] }[] = []
          for (const category of ASSET_CATEGORIES) {
            const dir = path.join(root, category)
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }
            const entries = fs.readdirSync(dir)
            const allowExt = CATEGORY_EXTS[category] || ['.png', '.jpg', '.jpeg', '.webp', '.gif']
            const files = entries
              .filter((name) => {
                const ext = path.extname(name).toLowerCase()
                return allowExt.includes(ext)
              })
              .map((name) => {
                const stat = fs.statSync(path.join(dir, name))
                return {
                  name,
                  path: `/api/asset?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}&root=${encodeURIComponent(root)}`,
                  mtime: stat.mtimeMs,
                }
              })
              .sort((a, b) => b.mtime - a.mtime)
            assets.push({ category, files })
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, assets }))
        } catch (err: any) {
          console.error('[list-assets] failed:', err.message)
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      })

      server.middlewares.use('/api/save-asset', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}') as {
              category?: string
              dataUrl?: string
              filename?: string
              root?: string
            }
            const root = resolveAssetRoot(data.root)
            const category = ASSET_CATEGORIES.includes(data.category || '') ? data.category! : '其他'
            const ext = CATEGORY_EXTS[category]?.[0] || '.png'
            const filename = data.filename || `ai-gen-${Date.now()}${ext}`
            const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '_')
            const dir = path.join(root, category)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            const filePath = path.join(dir, safeFilename)

            if (!data.dataUrl) {
              // 视频/音频占位：写入 1 字节占位文件
              fs.writeFileSync(filePath, Buffer.from([0]))
            } else {
              const match = data.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
              if (!match) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: 'invalid dataUrl' }))
                return
              }
              const base64 = match[2]
              fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: true,
                category,
                name: safeFilename,
                path: `/api/asset?category=${encodeURIComponent(category)}&name=${encodeURIComponent(safeFilename)}&root=${encodeURIComponent(root)}`,
              }),
            )
          } catch (err: any) {
            console.error('[save-asset] failed:', err.message)
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: err.message }))
          }
        })
      })

      server.middlewares.use('/api/asset', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next()
        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
          const category = url.searchParams.get('category') || '其他'
          const name = url.searchParams.get('name') || ''
          const root = resolveAssetRoot(url.searchParams.get('root'))
          if (!name) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: 'missing name' }))
            return
          }
          const filePath = path.join(root, category, name)
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404
            res.end(JSON.stringify({ ok: false, error: 'not found' }))
            return
          }
          const ext = path.extname(filePath).toLowerCase()
          const mime =
            ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.webp'
                  ? 'image/webp'
                  : ext === '.gif'
                    ? 'image/gif'
                    : ext === '.mp4'
                      ? 'video/mp4'
                      : ext === '.webm'
                        ? 'video/webm'
                        : ext === '.mov'
                          ? 'video/quicktime'
                          : ext === '.mp3'
                            ? 'audio/mpeg'
                            : ext === '.wav'
                              ? 'audio/wav'
                              : ext === '.ogg'
                                ? 'audio/ogg'
                                : 'application/octet-stream'
          res.setHeader('Content-Type', mime)
          res.setHeader('Cache-Control', 'public, max-age=300')
          res.statusCode = 200
          res.end(fs.readFileSync(filePath))
        } catch (err: any) {
          console.error('[asset] failed:', err.message)
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [rhSourcePlugin(), react(), openFolderPlugin(), assetLibraryPlugin(), aiServerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['.vibex.cn'],
    host: '0.0.0.0',
    port: 8000,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 8000,
  },
})
