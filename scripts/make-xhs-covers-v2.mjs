// 小红书 v2 封面：按信息流缩略图尺寸重做（大字、少字）
// 用法：node scripts/make-xhs-covers-v2.mjs
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const OUT = resolve('marketing/xiaohongshu/v2')
mkdirSync(OUT, { recursive: true })

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CANDIDATES.find((p) => p && existsSync(p))
if (!chrome) {
  console.error('没有找到 Chrome 或 Edge')
  process.exit(1)
}

const FONT = `"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif`

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1440px; overflow: hidden; }
body { font-family: ${FONT}; color: #f8fafc; -webkit-font-smoothing: antialiased; }
.card {
  position: relative; width: 1080px; height: 1440px; padding: 88px 80px;
  display: flex; flex-direction: column; justify-content: center; overflow: hidden;
  background:
    radial-gradient(1100px 780px at 86% -10%, rgba(52,211,153,.18), transparent 62%),
    radial-gradient(900px 720px at -12% 106%, rgba(56,189,248,.10), transparent 62%),
    #0b1220;
}
.kicker { font-size: 31px; letter-spacing: .22em; color: #94a3b8; font-weight: 600; }
.line { font-weight: 900; line-height: .98; letter-spacing: -.02em; }
.mono { font-variant-numeric: tabular-nums; }
.disclaimer { position: absolute; left: 80px; bottom: 44px; font-size: 22px; color: #475569; }
`

function page(body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="card">${body}<div class="disclaimer">演示数据 · 简化估算，不构成理财建议</div></div></body></html>`
}

const covers = {
  A: `
  <div class="kicker">退休倒计时</div>
  <div class="line" style="font-size:160px;color:#e2e8f0;margin-top:42px">还要上</div>
  <div class="line mono" style="font-size:380px;margin-top:10px;
    background:linear-gradient(135deg,#ffffff 16%,#34d399 118%);
    -webkit-background-clip:text;background-clip:text;color:transparent">8258</div>
  <div class="line" style="font-size:196px;color:#e2e8f0;margin-top:8px">天班</div>
  <div style="margin-top:64px;font-size:46px;font-weight:700;color:#fcd34d">算完我沉默了</div>`,

  B: `
  <div class="kicker">55 岁退休 · 社保够花吗</div>
  <div class="line" style="font-size:172px;color:#e2e8f0;margin-top:46px">每月差</div>
  <div style="display:flex;align-items:baseline;gap:16px;margin-top:6px">
    <span class="line mono" style="font-size:420px;color:#fb7185">554</span>
    <span class="line" style="font-size:104px;color:#fda4af">元</span>
  </div>
  <div style="margin-top:56px;font-size:54px;font-weight:700;color:#fcd34d">30 年，就是 15 万</div>`,

  C: `
  <div class="kicker">月薪 2 万 5</div>
  <div class="line" style="font-size:176px;color:#e2e8f0;margin-top:46px">退休只领</div>
  <div class="line" style="font-size:300px;color:#fbbf24;margin-top:12px;white-space:nowrap">1.1<span style="font-size:.62em;margin-left:.05em">万</span></div>
  <div style="margin-top:52px;font-size:52px;font-weight:700;color:#94a3b8">养老金只有工资的 46%</div>`,
}

const jobs = Object.entries(covers).map(([name, body]) => [name, page(body), 1080, 1440])

/* 信息流模拟：旧封面 vs 3 个新封面，按真实缩略尺寸 */
const feedTitles = {
  old: '人在上班，心在想以后的退休生活。。。',
  A: '我还要上8258天班才退休',
  B: '算完退休金，我不敢辞职了',
  C: '月薪2万5，退休每月只领1万1',
}
const feedImgs = {
  old: pathToFileURL(resolve(OUT, '../01.png')).href,
  A: pathToFileURL(join(OUT, 'A.png')).href,
  B: pathToFileURL(join(OUT, 'B.png')).href,
  C: pathToFileURL(join(OUT, 'C.png')).href,
}
const feedHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 560px; overflow: hidden; }
body { background: #fff; font-family: ${FONT}; padding: 34px 40px; }
.note { font-size: 17px; color: #999; margin-bottom: 18px; }
.row { display: flex; gap: 30px; }
.item { width: 220px; }
.tag { font-size: 17px; color: #ff2442; font-weight: 700; margin-bottom: 8px; }
.cover { width: 220px; height: 293px; border-radius: 10px; overflow: hidden; background: #eee; }
.cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.title { margin-top: 10px; font-size: 20px; line-height: 1.45; color: #333; }
</style></head><body>
<div class="note">小红书信息流模拟 · 封面实际显示约 220px 宽（手机截图缩放到桌面后的尺寸）</div>
<div class="row">
  ${['old', 'A', 'B', 'C']
    .map(
      (k) => `<div class="item">
    <div class="tag">${k === 'old' ? '旧封面（已发）' : '新 ' + k}</div>
    <div class="cover"><img src="${feedImgs[k]}"></div>
    <div class="title">${feedTitles[k]}</div>
  </div>`,
    )
    .join('')}
</div>
</body></html>`

const tmp = mkdtempSync(join(tmpdir(), 'xhs2-'))
const profile = join(tmp, 'profile')

function shoot(html, out, w, h) {
  const htmlPath = join(tmp, `${out.replace(/[^\w]/g, '_')}.html`)
  writeFileSync(htmlPath, html, 'utf8')
  const r = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=1',
      `--window-size=${w},${h}`,
      '--virtual-time-budget=1200',
      `--user-data-dir=${profile}`,
      `--screenshot=${join(OUT, out)}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(r.stderr?.slice(-400) || 'screenshot failed')
  console.log('生成', out)
}

for (const [name, html, w, h] of jobs) shoot(html, `${name}.png`, w, h)
writeFileSync(join(OUT, 'feed-test.html'), feedHtml, 'utf8')
shoot(feedHtml, 'feed-test.png', 1080, 560)

rmSync(tmp, { recursive: true, force: true })
console.log('完成：', OUT)
