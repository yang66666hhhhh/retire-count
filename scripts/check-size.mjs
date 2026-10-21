// 构建体积守门
//
// 说明：ECharts 5 的最小可用线图（core + line + grid + tooltip + canvas）
// 实测约 150KB gzip，本身就无法和 Vue 应用一起塞进 200KB。
// 因此预算按「首屏 JS/CSS/HTML」计算，图表 chunk 通过 IntersectionObserver 按需加载。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, join, extname } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const INITIAL_BUDGET_KB = 200
const DEFERRED_WARN_KB = 170

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function isDeferred(name) {
  return name.startsWith('charts-') || name.startsWith('GapChart-')
}

const files = walk(DIST)
  .filter((file) => ['.js', '.css', '.html'].includes(extname(file)))
  .map((file) => {
    const raw = readFileSync(file)
    const name = file.split(/[\\/]/).pop() ?? ''
    return {
      name,
      raw: raw.length,
      gzip: gzipSync(raw, { level: 9 }).length,
      deferred: isDeferred(name),
    }
  })
  .sort((a, b) => b.gzip - a.gzip)

const initial = files.filter((f) => !f.deferred)
const deferred = files.filter((f) => f.deferred)
const sum = (list) => list.reduce((total, f) => total + f.gzip, 0)
const kb = (n) => `${(n / 1024).toFixed(1)} KB`

function printGroup(title, list, total) {
  console.log(`\n  ${title}`)
  console.log('  ' + '-'.repeat(58))
  for (const f of list) {
    console.log(`  ${f.name.padEnd(38)} ${kb(f.raw).padStart(9)} ${kb(f.gzip).padStart(10)}`)
  }
  console.log('  ' + '-'.repeat(58))
  console.log(`  ${'小计'.padEnd(38)} ${''.padStart(9)} ${kb(total).padStart(10)}`)
}

const initialTotal = sum(initial)
const deferredTotal = sum(deferred)

printGroup('首屏（entry + css + html + workbox）', initial, initialTotal)
printGroup('按需加载（ECharts 图表）', deferred, deferredTotal)

console.log(
  `\n  首屏预算 ${INITIAL_BUDGET_KB} KB gzip · 实际 ${kb(initialTotal)} · 余量 ${kb(INITIAL_BUDGET_KB * 1024 - initialTotal)}`,
)
console.log(`  图表 chunk ${kb(deferredTotal)}（滚动到图表时才下载）\n`)

let failed = false

if (initialTotal > INITIAL_BUDGET_KB * 1024) {
  console.error(`  ✗ 首屏超出预算 ${kb(initialTotal - INITIAL_BUDGET_KB * 1024)}\n`)
  failed = true
}

if (deferredTotal > DEFERRED_WARN_KB * 1024) {
  console.error(`  ✗ 图表 chunk 超过 ${DEFERRED_WARN_KB}KB，检查是否误引全量 echarts\n`)
  failed = true
}

if (failed) process.exit(1)

console.log('  ✓ 体积检查通过\n')
