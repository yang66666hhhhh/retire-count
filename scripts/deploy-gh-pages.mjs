// 把 dist 发到 gh-pages 分支（本地构建，绕开 CI 里不稳定的 npm 安装）
// 用法：npm run deploy
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    console.error(`\n命令失败：${cmd} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
  return result
}

const remoteResult = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })
const remote = remoteResult.stdout?.trim()
if (!remote) {
  console.error('没有找到 origin 远程仓库，请先 git remote add origin <url>')
  process.exit(1)
}

const repo = remote.replace(/\.git$/, '').split(/[/:]/).pop()
const base = `/${repo}/`
console.log(`仓库：${repo}`)
console.log(`base：${base}`)

run('npm', ['run', 'build'], {
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_BASE: base },
})

const dir = mkdtempSync(join(tmpdir(), 'retire-count-gh-pages-'))
for (const entry of readdirSync('dist')) {
  cpSync(join('dist', entry), join(dir, entry), { recursive: true })
}
writeFileSync(join(dir, '.nojekyll'), '')

run('git', ['-C', dir, 'init', '-q', '-b', 'gh-pages'])
run('git', ['-C', dir, 'add', '-A'])
run('git', [
  '-C', dir,
  '-c', 'user.name=retire-count-deploy',
  '-c', 'user.email=deploy@local',
  'commit', '-q', '-m', `deploy ${new Date().toISOString()}`,
])
run('git', ['-C', dir, 'push', '-f', remote, 'HEAD:gh-pages'])
rmSync(dir, { recursive: true, force: true })

console.log('\n已推送到 gh-pages 分支。')
console.log('如果还没配置过：仓库 Settings -> Pages -> Source 选 "Deploy from a branch"，分支选 gh-pages / (root)。')
