// 清理 dist。
//
// 注意：这个项目放在 OneDrive 同步目录下，Node 的 fs.rmSync 在本机
// 会「静默失败」——返回成功但目录仍在，导致 Vite 的 emptyOutDir 失效、
// 旧 hash 文件堆积。这里改用「先改名、再删除」，改名是可靠的。
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
if (!existsSync(dist)) process.exit(0)

const trash = resolve(process.cwd(), `.trash-${Date.now()}`)

try {
  renameSync(dist, trash)
} catch (error) {
  console.warn('[clean] 无法移动 dist，跳过清理：', error.message)
  process.exit(0)
}

try {
  rmSync(trash, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
} catch {
  // 删除失败就留在 .trash-* 里（已 gitignore），不影响构建
}

// 顺手清理历史残留（同样可能失败，忽略即可）
for (const entry of readdirSync(process.cwd())) {
  if (!entry.startsWith('.trash-')) continue
  try {
    rmSync(resolve(process.cwd(), entry), { recursive: true, force: true })
  } catch {
    /* 交给用户手动删除 */
  }
}
