import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'

// 资源库插件：列目录、保存 base64 资源、读取资源文件 + 打开本地文件夹。
// 被 vite.config.ts 与 vibex-local/vite.local.config.ts 共享。

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

/** 点击打开文件夹：由 Vite dev server 调用系统命令打开本地目录。 */
export function openFolderPlugin() {
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

/** 资源库 API：列目录、保存 base64 资源、读取资源文件。 */
export function assetLibraryPlugin() {
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
