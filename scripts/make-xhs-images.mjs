// 生成小红书 3:4 配图（1080×1440）
// 用法：node scripts/make-xhs-images.mjs
// 依赖：本机安装的 Chrome / Edge（无第三方 npm 包）
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const OUT_DIR = resolve('marketing/xiaohongshu')
mkdirSync(OUT_DIR, { recursive: true })

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => p && existsSync(p))
if (!chrome) {
  console.error('没有找到 Chrome 或 Edge，无法截图')
  process.exit(1)
}

const FONT = `"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif`

const baseCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1440px; overflow: hidden; }
body {
  font-family: ${FONT};
  color: #f8fafc;
  background: #0b1220;
  -webkit-font-smoothing: antialiased;
}
.card {
  position: relative;
  width: 1080px;
  height: 1440px;
  padding: 88px 80px;
  overflow: hidden;
  background:
    radial-gradient(1100px 760px at 88% -8%, rgba(52,211,153,.16), transparent 62%),
    radial-gradient(900px 720px at -12% 104%, rgba(56,189,248,.11), transparent 62%),
    #0b1220;
}
.kicker {
  font-size: 23px;
  letter-spacing: .3em;
  color: #64748b;
  font-weight: 600;
}
.h1 { font-size: 58px; font-weight: 800; letter-spacing: -.01em; line-height: 1.25; }
.h2 { font-size: 46px; font-weight: 700; line-height: 1.35; }
.sub { font-size: 28px; color: #94a3b8; line-height: 1.65; }
.muted { color: #64748b; }
.emerald { color: #34d399; }
.amber { color: #fbbf24; }
.rose { color: #fb7185; }
.sky { color: #38bdf8; }
.mono { font-variant-numeric: tabular-nums; }
.pill {
  display: inline-flex; align-items: center;
  padding: 12px 24px; border-radius: 999px;
  font-size: 24px; color: #a7f3d0;
  border: 2px solid rgba(52,211,153,.28);
  background: rgba(52,211,153,.08);
}
.chip {
  position: absolute; right: 76px; top: 70px;
  padding: 9px 20px; border-radius: 999px;
  font-size: 20px; color: #fcd34d;
  border: 2px solid rgba(251,191,36,.26);
  background: rgba(251,191,36,.08);
}
.page {
  position: absolute; right: 80px; bottom: 54px;
  font-size: 21px; letter-spacing: .16em; color: #475569;
}
.footnote {
  position: absolute; left: 80px; bottom: 54px;
  font-size: 21px; color: #475569;
}
.cardBox {
  border-radius: 30px;
  border: 2px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.028);
}
`

function page(index, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${baseCss}</style></head><body>
<div class="card">${body}<div class="page">${String(index).padStart(2, '0')} / 09</div></div>
</body></html>`
}

/* ---------- 数据（与演示档案一致） ---------- */
const DATA = {
  days: '8,258',
  pension: '¥11,446',
  gapTotal: '¥151,730',
  save: '¥447',
  gap: '¥554',
  target: '¥12,000',
  replace: '46%',
  coverage: 95,
}

function money(n) {
  return n.toLocaleString('zh-CN')
}

/* ---------- 06 缺口曲线 ---------- */
function chartSvg() {
  const W = 920
  const H = 700
  const top = 30
  const bottom = 40
  const plotH = H - top - bottom
  const max = 200000
  const n = 31
  const xs = (i) => (i / (n - 1)) * W
  const ys = (v) => top + (1 - v / max) * plotH

  const target = []
  const pension = []
  for (let i = 0; i < n; i++) {
    const age = 55 + i
    let factor = 1
    if (age > 65) factor = 1 - 0.08 * Math.min(1, (age - 65) / 10)
    if (age > 75) factor = 0.92 + 0.38 * Math.min(1, (age - 75) / 10)
    target.push(144000 * factor)
    pension.push(137352 * (1 - 0.0115 * i))
  }

  const line = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
  const greenArea = `${line(pension)} L${W},${ys(0)} L0,${ys(0)} Z`
  const redArea = `${line(target)} ${pension
    .map((v, i) => `L${xs(n - 1 - i).toFixed(1)},${ys(pension[n - 1 - i]).toFixed(1)}`)
    .join(' ')} Z`

  const grid = [0, 50000, 100000, 150000, 200000]
    .map(
      (v) => `<line x1="0" y1="${ys(v)}" x2="${W}" y2="${ys(v)}" stroke="rgba(148,163,184,.12)" stroke-dasharray="6 8"/>
      <text x="0" y="${ys(v) - 10}" fill="#64748b" font-size="20">${v === 0 ? '0' : money(v / 10000) + ' 万'}</text>`,
    )
    .join('')

  const xLabels = [55, 65, 75, 85]
    .map((age) => {
      const i = age - 55
      const anchor = age === 55 ? 'start' : age === 85 ? 'end' : 'middle'
      return `<text x="${xs(i)}" y="${H - 8}" fill="#64748b" font-size="20" text-anchor="${anchor}">${age} 岁</text>`
    })
    .join('')

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <path d="${redArea}" fill="rgba(251,113,133,.24)"/>
    <path d="${greenArea}" fill="rgba(52,211,153,.28)"/>
    <path d="${line(target)}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="10 9"/>
    <path d="${line(pension)}" fill="none" stroke="#34d399" stroke-width="2.5"/>
    ${xLabels}
  </svg>`
}

/* ---------- 卡片内容 ---------- */
const cards = []

/* 01 封面 */
cards.push(`
<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
  <div class="kicker" style="margin-bottom:36px">RETIRECOUNT · 退休倒计时</div>
  <div style="font-size:44px;font-weight:600;color:#94a3b8;letter-spacing:.04em">你还要上</div>
  <div class="mono" style="font-size:300px;font-weight:900;line-height:.9;letter-spacing:-.045em;margin:10px 0 0;
       background:linear-gradient(135deg,#ffffff 18%,#34d399 115%);-webkit-background-clip:text;background-clip:text;color:transparent">8<span style="font-size:.4em;vertical-align:.12em;margin:0 .02em 0 -.01em">,</span>258</div>
  <div style="font-size:70px;font-weight:800;color:#e2e8f0;letter-spacing:.08em;margin-top:14px">天班？</div>
  <div style="margin-top:60px;font-size:36px;line-height:1.62;color:#94a3b8">
    输入生日，30 秒算清<br><span style="color:#e2e8f0">退休金够不够花</span>
  </div>
  <div style="margin-top:56px;display:flex;gap:16px;flex-wrap:wrap">
    <span class="pill">免费</span><span class="pill">不用登录</span><span class="pill">数据只存本机</span>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:76px;text-align:center;font-size:26px;color:#64748b;letter-spacing:.08em">
    往下滑，看 3 个具体数字 ↓
  </div>
</div>`)

/* 02 倒计时 */
cards.push(`
<div class="chip">演示数据</div>
<div style="height:100%;display:flex;flex-direction:column;justify-content:center">
  <div style="display:flex;align-items:center;gap:14px;font-size:28px;color:#94a3b8">
    <span style="width:10px;height:10px;border-radius:50%;background:#34d399"></span>距离退休还有
  </div>
  <div class="mono" style="font-size:250px;font-weight:900;line-height:1;letter-spacing:-.05em;margin-top:24px">
    8<span style="font-size:.4em;vertical-align:.1em;margin:0 .02em 0 -.01em">,</span>258
  </div>
  <div style="font-size:48px;color:#94a3b8;font-weight:600;margin-top:2px">天</div>
  <div style="font-size:26px;color:#64748b;margin-top:14px">≈ 22.6 年 · 约 5,900 个工作日</div>

  <div style="display:flex;gap:16px;margin-top:48px">
    ${['08 时', '24 分', '36 秒']
      .map(
        (t) => `<div class="cardBox" style="padding:18px 22px;font-size:34px;font-weight:700;color:${
          t.includes('秒') ? '#34d399' : '#e2e8f0'
        }">${t}</div>`,
      )
      .join('')}
  </div>

  <div style="margin-top:52px;display:flex;align-items:center;gap:20px">
    <svg width="170" height="170" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="#34d399" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="326" stroke-dashoffset="241" transform="rotate(-90 60 60)"/>
      <text x="60" y="58" text-anchor="middle" fill="#f8fafc" font-size="24" font-weight="700">26%</text>
      <text x="60" y="82" text-anchor="middle" fill="#64748b" font-size="14">工作进度</text>
    </svg>
    <div class="sub" style="font-size:27px">
      退休日 <span style="color:#e2e8f0">2049 年 6 月 1 日</span><br>
      已工作 <span style="color:#e2e8f0">8.0</span> 年 · 缴费 <span style="color:#e2e8f0">8</span> 年
    </div>
  </div>

  <div style="margin-top:48px;font-size:30px;color:#fcd34d;line-height:1.5">时间还宽裕，越早开始越轻松</div>
</div>
<div class="footnote">它帮你数到退休那天</div>`)

/* 03 一句话结论 */
cards.push(`
<div class="chip">演示数据</div>
<div class="kicker">一句话结论</div>
<div class="cardBox" style="margin-top:36px;padding:52px 46px;border-color:rgba(251,191,36,.22);background:rgba(251,191,36,.06)">
  <div style="font-size:44px;line-height:1.75;color:#f1f5f9">
    你 55 岁退休后，社保每月大约发
    <span class="emerald" style="font-weight:800">¥11,446</span>；
    想花 ¥12,000，<br>
    <span class="rose" style="font-weight:800">每月差 ¥554</span>。
  </div>
  <div style="margin-top:34px;padding-top:30px;border-top:2px solid rgba(255,255,255,.09);font-size:32px;line-height:1.7;color:#fde68a">
    想补上：从今天起每月存 <b>¥447</b>，<br>按年化 5% 算，到退休正好攒够。
  </div>
</div>

<div style="margin-top:56px;font-size:26px;color:#94a3b8">把三个数摆在一起：</div>
${[
  ['想花', '¥12,000', 100, '#fbbf24'],
  ['社保', '¥11,446', 95.4, '#34d399'],
  ['缺口', '¥554', 4.6, '#fb7185'],
]
  .map(
    ([label, value, pct, color]) => `
  <div style="display:flex;align-items:center;gap:18px;margin-top:24px">
    <span style="width:96px;font-size:26px;color:#94a3b8">${label}</span>
    <div style="flex:1;height:26px;border-radius:999px;background:rgba(255,255,255,.05);overflow:hidden">
      <div style="width:${pct}%;height:100%;border-radius:999px;background:${color}"></div>
    </div>
    <span class="mono" style="width:180px;text-align:right;font-size:28px;font-weight:700;color:${color}">${value}</span>
  </div>`,
  )
  .join('')}

<div style="position:absolute;left:80px;right:80px;bottom:132px;text-align:center;font-size:27px;color:#64748b">
  554 看起来不多，<span class="amber">30 年就是 15 万</span> →
</div>
<div class="footnote">演示档案：上海 · 1994 年 · 月薪 ¥25,000</div>`)

/* 04 三个数字 */
cards.push(`
<div class="chip">演示数据</div>
<div class="h1">三个数字，看懂退休金</div>
<div class="sub" style="margin-top:16px">人话版，不用懂社保公式</div>

${[
  ['社保每月发', '¥11,446', '≈ 现在工资的 46%', '#34d399', 'rgba(52,211,153,.07)', 'rgba(52,211,153,.2)'],
  ['退休时还差', '¥151,730', '按今天的钱算 · 覆盖退休后 30 年', '#fbbf24', 'rgba(251,191,36,.07)', 'rgba(251,191,36,.2)'],
  ['现在每月存', '¥447', '按年化 5% 存到退休', '#38bdf8', 'rgba(56,189,248,.07)', 'rgba(56,189,248,.2)'],
]
  .map(
    ([label, value, note, color, bg, border], i) => `
  <div class="cardBox" style="margin-top:${i === 0 ? 56 : 26}px;padding:38px 42px;background:${bg};border-color:${border}">
    <div style="font-size:27px;color:#94a3b8">${label}</div>
    <div class="mono" style="font-size:88px;font-weight:900;letter-spacing:-.02em;color:${color};margin-top:10px">${value}</div>
    <div style="font-size:24px;color:#64748b;margin-top:8px">${note}</div>
  </div>`,
  )
  .join('')}
<div class="footnote">数字会随你的档案实时变化</div>`)

/* 05 钱从哪来 */
cards.push(`
<div class="chip">演示数据</div>
<div class="kicker">钱从哪里来</div>
<div class="h1" style="margin-top:26px">退休后每月 ¥12,000，<br>社保发多少？</div>

<div style="margin-top:78px;display:flex;height:64px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.06)">
  <div style="width:95%;background:linear-gradient(90deg,#10b981,#34d399);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#052e21">社保 95%</div>
  <div style="width:5%;background:linear-gradient(90deg,#fb7185,#f43f5e)"></div>
</div>

<div style="display:flex;justify-content:space-between;margin-top:26px;font-size:27px">
  <span class="emerald">社保 ¥11,446</span>
  <span class="rose">自己补 ¥554 · 5%</span>
</div>

<div class="cardBox" style="margin-top:64px;padding:44px">
  <div style="font-size:34px;line-height:1.7;color:#cbd5e1">
    社保能覆盖 <span class="emerald" style="font-weight:800">95%</span>，
    剩下 <span class="rose" style="font-weight:800">¥554</span> 得自己补。
  </div>
  <div style="margin-top:22px;font-size:25px;color:#64748b;line-height:1.7">
    别小看这 554：它会跟着你 30 年。
  </div>
</div>

<div style="margin-top:56px;display:flex;align-items:baseline;gap:16px;font-size:29px;color:#94a3b8">
  <span class="mono">¥554 × 12 个月 × 30 年</span>
  <span>≈</span>
  <span class="mono" style="font-size:40px;font-weight:800;color:#fbbf24">¥199,440</span>
</div>
<div style="margin-top:18px;font-size:26px;line-height:1.75;color:#64748b">
  这是不折现的总额。<br>
  折算成退休那天要准备的钱，是 <span style="color:#fbbf24">¥151,730</span>。
</div>

<div class="cardBox" style="margin-top:44px;padding:30px 36px">
  <div style="font-size:25px;color:#64748b">同样补这 15 万，开始得越早越轻松</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:18px">
    <span style="font-size:24px;color:#94a3b8">25 岁开始</span>
    <span class="mono" style="font-size:38px;font-weight:800;color:#34d399">¥311 / 月</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px">
    <span style="font-size:24px;color:#94a3b8">35 岁开始</span>
    <span class="mono" style="font-size:38px;font-weight:800;color:#fb7185">¥518 / 月</span>
  </div>
</div>
<div class="footnote">越早开始补，每月压力越小</div>`)

/* 06 曲线 */
cards.push(`
<div class="chip">演示数据</div>
<div class="h1">退休后每年：想花多少<br>vs 社保发多少</div>
<div style="display:flex;gap:30px;margin-top:30px;font-size:23px;color:#94a3b8">
  <span><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#fbbf24;margin-right:10px"></i>想花的钱</span>
  <span><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#34d399;margin-right:10px"></i>社保发的</span>
  <span><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#fb7185;margin-right:10px"></i>自己要补的</span>
</div>
<div style="margin-top:10px">${chartSvg()}</div>
<div style="margin-top:22px;font-size:27px;line-height:1.7;color:#cbd5e1">
  红色越宽，自己要补的越多。<br>
  <span style="color:#94a3b8;font-size:24px">65 岁后护理开销上涨，养老金涨幅通常慢于物价。</span>
</div>
<div class="cardBox" style="margin-top:24px;padding:24px 30px;display:flex;align-items:center;justify-content:space-between;font-size:23px">
  <span style="color:#64748b">85 岁那年</span>
  <span style="color:#cbd5e1">想花 <b class="amber">18.7 万</b> · 社保 <b class="emerald">9.0 万</b> · 缺口 <b class="rose">9.7 万</b></span>
</div>
<div class="footnote">简化模型：65 岁后支出 ×1.3，养老金年涨幅低 15%</div>`)

/* 07 生活蓝图 */
cards.push(`
<div style="display:flex;align-items:center;gap:18px">
  <div class="h1" style="font-size:52px">退休生活蓝图</div>
  <span class="pill" style="font-size:22px;padding:8px 18px">完成 3 / 12</span>
</div>
<div class="sub" style="margin-top:14px">退休不只是钱的事</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:48px">
  ${[
    ['财务', ['还清房贷', '补上养老金缺口', '留 12 个月应急金'], [1, 1, 0]],
    ['健康', ['每周游泳两次', '年度体检', '23 点前睡'], [1, 0, 0]],
    ['兴趣', ['学水彩', '走完川西', '拍一组胶片'], [0, 0, 0]],
    ['关系', ['每月老友饭局', '陪爸妈旅行', '给伴侣写封信'], [0, 0, 0]],
  ]
    .map(
      ([title, items, done]) => `
    <div class="cardBox" style="padding:36px 32px;min-height:340px">
      <div style="font-size:30px;font-weight:700;color:#e2e8f0;margin-bottom:24px">${title}</div>
      ${items
        .map(
          (it, i) => `
        <div style="display:flex;align-items:flex-start;gap:14px;margin-top:16px">
          <span style="flex:0 0 auto;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;
            font-size:18px;font-weight:800;
            ${
              done[i]
                ? 'background:rgba(52,211,153,.18);border:2px solid rgba(52,211,153,.45);color:#34d399'
                : 'border:2px solid rgba(255,255,255,.16);color:transparent'
            }">✓</span>
          <span style="font-size:24px;line-height:1.45;color:${done[i] ? '#94a3b8' : '#cbd5e1'};${done[i] ? 'text-decoration:line-through' : ''}">${it}</span>
        </div>`,
        )
        .join('')}
    </div>`,
    )
    .join('')}
</div>

<div class="cardBox" style="margin-top:30px;padding:32px 36px">
  <div style="font-size:29px;line-height:1.7;color:#94a3b8">
    “退休不是突然停下来，<br>而是把时间还给自己。”
  </div>
</div>
<div class="footnote">财务 / 健康 / 兴趣 / 关系，四块都写几笔</div>`)

/* 08 隐私 */
cards.push(`
<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
  <svg width="170" height="196" viewBox="0 0 24 26" style="margin-bottom:44px">
    <path d="M12 1.5 21 5v7.2c0 5.8-3.7 10.4-9 11.8-5.3-1.4-9-6-9-11.8V5l9-3.5Z"
      fill="rgba(52,211,153,.1)" stroke="#34d399" stroke-width="1.2"/>
    <path d="m7.6 12.4 3 3.1 6-6.3" fill="none" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div class="h1" style="font-size:62px">不用登录<br>数据只存本机</div>
  <div style="margin-top:52px;space-y:0">
    ${['无账号 · 不用手机号', '无服务器 · 不上传任何数据', '无统计代码 · 不追踪你']
      .map(
        (t) => `<div style="display:flex;align-items:center;gap:16px;margin-top:22px;font-size:29px;color:#cbd5e1">
          <span style="width:12px;height:12px;border-radius:50%;background:#34d399;flex:0 0 auto"></span>${t}</div>`,
      )
      .join('')}
  </div>
  <div class="cardBox" style="margin-top:58px;padding:32px 36px;font-size:28px;color:#a7f3d0">
    断网也能打开 · 可加到桌面当 App
  </div>
  <div class="footnote">纯前端，数据不出设备</div>
</div>`)

/* 09 结尾 */
cards.push(`
<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center">
  <div class="kicker" style="margin-bottom:38px">免费 · 30 秒</div>
  <div style="font-size:96px;font-weight:900;letter-spacing:-.02em;line-height:1.15">
    搜 <span class="emerald">RetireCount</span>
  </div>
  <div style="font-size:38px;color:#94a3b8;margin-top:30px;line-height:1.6">
    浏览器打开，输入生日就能用
  </div>
  <div style="display:flex;gap:16px;margin-top:56px;flex-wrap:wrap;justify-content:center">
    <span class="pill">不用注册</span><span class="pill">没有广告</span><span class="pill">可离线</span>
  </div>
  <div style="margin-top:120px;font-size:23px;color:#475569;line-height:1.9">
    简化估算，不是社保局核定结果<br>不构成理财建议
  </div>
</div>`)

/* ---------- 生成 ---------- */
const tmp = mkdtempSync(join(tmpdir(), 'xhs-'))
const profile = join(tmp, 'profile')
let failures = 0

cards.forEach((body, i) => {
  const no = String(i + 1).padStart(2, '0')
  const htmlPath = join(tmp, `card-${no}.html`)
  const outPath = join(OUT_DIR, `${no}.png`)
  writeFileSync(htmlPath, page(i + 1, body), 'utf8')

  const result = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=1',
      '--window-size=1080,1440',
      '--virtual-time-budget=1200',
      `--user-data-dir=${profile}`,
      `--screenshot=${outPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    failures += 1
    console.error(`第 ${no} 张失败：`, result.stderr?.slice(-300))
  } else {
    console.log(`生成 ${no}.png`)
  }
})

rmSync(tmp, { recursive: true, force: true })

if (failures > 0) {
  console.error(`${failures} 张失败`)
  process.exit(1)
}
console.log(`\n完成：${OUT_DIR}`)
