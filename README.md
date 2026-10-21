# RetireCount · 退休倒计时

一个纯前端、本地优先（Local-First）的退休规划单页应用：看退休倒计时、测养老金缺口、写退休生活蓝图。

**没有后端、没有数据库、没有账号、没有统计代码。所有数据只存在你这台设备的 localStorage 里。**

---

## 功能

| 模块 | 说明 |
|---|---|
| 退休倒计时 | 天 / 时 / 分 / 秒 + 工作阶段进度环，按 `Date.now()` 每秒重算，不累加、不漂移 |
| 三步入场引导 | 出生年月 + 性别 → 退休年龄 + 城市 → 月薪 + 已缴年限 + 目标支出；可跳过看演示数据 |
| 退休金测算 | 基础养老金 + 个人账户双段模型，输出月养老金、退休时点缺口现值、每月需储蓄 |
| 缺口曲线 | ECharts 堆叠面积图：目标支出（虚线）、养老金（绿）、缺口（红），从退休年龄到 +30 年 |
| 生活蓝图 | 财务 / 健康 / 兴趣 / 关系四宫格，增删改、勾选完成、拖拽排序（原生 HTML5，无拖拽库） |
| 备份 | 导出 JSON / 导入（覆盖或合并，带 schema 校验）/ 二次确认重置 |
| PWA | 可安装、可离线，断网刷新数据仍在，恢复网络前顶部提示「已离线」 |

---

## 技术栈

- Vue 3.5 + Vite 5 + TypeScript（strict）
- Tailwind CSS 3.4（不使用组件库；Dialog 用 `reka-ui`，图标用 `lucide-vue-next`）
- Pinia 3 + `pinia-plugin-persistedstate` 4（自定义 300ms 防抖 storage）
- ECharts 5（按需注册 + 动态 import + 视口内才加载）
- `vite-plugin-pwa`（manifest + Workbox Service Worker）

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 构建
npm run deploy     # 构建并发布到 GitHub Pages（gh-pages 分支）
npm test           # 单元测试（39 个用例）
npm run size       # 打印 gzip 体积并做预算断言
npm run icons      # 从 public/icon.svg 重新生成 PWA 图标（需先 npm i -D sharp）
```

---

## 目录结构

```
src/
├─ components/
│  ├─ CountdownCard.vue        # 倒计时卡片 + 进度环
│  ├─ IncomeCalculator.vue     # 测算表单 + 结果 + 图表容器（视口内加载）
│  ├─ GapChart.vue             # ECharts 面积图（异步 chunk）
│  ├─ LifePlanBoard.vue        # 四宫格看板 + 拖拽编排
│  ├─ PlanBucket.vue           # 单列计划项（增删改、勾选、排序）
│  ├─ BackupModal.vue          # 导出 / 导入 / 重置
│  ├─ OnboardingWizard.vue     # 三步引导
│  ├─ MonetizeSlot.vue         # 3 个商业化占位（仅 console.log）
│  ├─ OfflineBanner.vue        # 离线提示
│  └─ ui/                      # Dialog / NumberField / ProgressRing / ToastHost
├─ composables/                # useCountdown / useToast
├─ data/                       # cities.ts（社平工资、计发月数、支出曲线）/ planCategories.ts
├─ stores/                     # index.ts（持久化层）+ 3 个业务 store
├─ types/                      # 全部类型定义
├─ utils/                      # retirementMath / format / exportData
└─ views/HomeView.vue
```

---

## 算法规格（`src/utils/retirementMath.ts`）

### 口径

1. **所有金额均为「今日购买力」**，名义利率先折算为实际利率再参与计算。
2. 内部金额单位是**分（整数）**，中间除法允许浮点，出口统一 `Math.round()`。
3. 这是简化模型，**不是社保官方口径**，结果页有免责声明。

### 公式

```
M  = max(0, ceil((退休日 - 今天) / 86400000))        天
n  = M / 30.4375                                      月
t  = M / 365.2425                                     年
y  = clamp(已缴年限 + t, 0, 40)                       总缴费年限
k  = clamp(月薪 / 城市社平, 0.6, 3.0)                 缴费指数
r  = (1 + 投资回报) / (1 + 通胀) - 1                  实际年化
rm = (1 + r)^(1/12) - 1                               实际月化
```

**基础养老金**（今日购买力）

```
B = 社平 × (1 + k) / 2 × y × 1%
```

**个人账户养老金**

```
A0 = 个人账户余额（未填则按 月薪 × 8% × 12 × 已缴年限 估算）
A1 = A0 × (1+g)^t + 月薪×8%×12 × ((1+g)^t - 1) / g     g = 2%（实际记账利率）
P  = A1 / 计发月数(退休年龄)                            59 岁 145，60 岁 139，55 岁 170
```

`estimatedMonthlyPension = B + P`

**退休时点缺口现值**（30 年、期初年金）

```
月缺口 = max(0, 目标月支出 - 月养老金)
PV = 月缺口 × (1 - (1+rm)^-360) / rm × (1+rm)
```

**每月需额外储蓄**

```
月储蓄 = PV × rm / ((1+rm)^n - 1)      n ≤ 0 时为 0；rm ≈ 0 时退化为 PV / n
```

### 投影曲线为什么不是三条直线

如果养老金和支出都用常数，图会是三条水平线，没有信息量。这里引入两个可解释假设（集中在 `retirementMath.ts` 顶部常量）：

1. **退休支出微笑曲线**：活跃期 1.0 → 70 岁 1.06 → 78 岁 0.92 → 85 岁 1.05 → 90 岁 1.30（护理期回升）。
2. **养老金购买力衰减**：养老金年度调整幅度低于真实通胀约 15%，即每年实际缩水 ≈ 0.45%。

两者叠加后，缺口会逐年放大——这才是真实的风险形状。

### 工作阶段进度

```
workStart = 今天 - 已缴年限        （夹在「出生 + 16 岁」与「退休日」之间）
progress  = (今天 - workStart) / (退休日 - workStart)
```

### 边界约定

- **月薪为 0 时**，不再把「到退休前的空档」计为缴费年限，缴费指数也按 0 处理。否则会被 0.6 的指数下限凭空算出一笔养老金。
- 缴费年限封顶 40 年；缴费指数夹在 0.6 ~ 3.0；退休年龄夹在 45 ~ 70。
- 三段金额各自 `Math.round()` 到「分」，所以 `基础养老金 + 个人账户` 与合计之间可能有 ≤ 1 分的舍入差。

---

## 数据与存储

| key | 内容 |
|---|---|
| `retire-count-v1:profile` | 出生年月、性别、退休年龄、城市、onboarded |
| `retire-count-v1:finance` | 月薪、已缴年限、目标月支出、通胀、回报、个人账户余额 |
| `retire-count-v1:plans` | 四类计划清单 |

- 写入**防抖 300ms**，并在 `pagehide` / `beforeunload` / 页面隐藏时强制 flush。
- 读取时先看 pending 队列，保证「同一 tick 写完立刻读」拿到新值。
- 序列化器带**默认值兜底**：旧备份缺字段时会补默认值而不是变成 `undefined`。
- 不用 cookie、不用 IndexedDB、不发任何网络请求。

### 备份格式

```json
{
  "app": "RetireCount",
  "schemaVersion": 1,
  "exportedAt": "2026-10-21T09:00:00.000Z",
  "data": { "profile": {}, "finance": {}, "plans": { "items": [] } }
}
```

- 导出文件名：`retire-count-backup-YYYYMMDD.json`（`Blob` + `<a download>`，不经过网络）。
- 导入校验：`app` 标识、版本号（高于当前版本直接拒绝）、字段类型与范围（越界自动修正并提示）。
- **覆盖导入**：全部替换。
- **合并导入**：计划按 id 去重、同 id 取 `updatedAt` 较新者；档案仅在本机未建过档时采用；测算参数保留本机。

---

## PWA

- `name: RetireCount · 退休倒计时`，`short_name: RetireCount`，`theme_color: #0f172a`。
- 图标由 `public/icon.svg`（沙漏）通过 `npm run icons` 生成 192/512/maskable-512/apple-touch-icon-180。
- Workbox 预缓存全部静态资源，`navigateFallback: index.html`。
- 离线时顶部出现提示条，并弹一次「已离线，数据保存在本机」。

---

## 体积（实测，gzip）

| 分组 | 内容 | 体积 |
|---|---|---|
| 首屏 | entry JS + CSS + HTML + workbox | **≈ 94 KB** |
| 按需 | ECharts chunk + GapChart 包装 | **≈ 154 KB** |

预算断言：`npm run size` 要求首屏 ≤ 200KB、图表 chunk ≤ 170KB。

> **为什么不是「总共 < 200KB」**：ECharts 5 的最小可用线图（core + line + grid + tooltip + canvas）实测就是 **≈ 154KB gzip**，单它一个就吃掉大半预算。因此本项目的做法是：首屏严格控制在 200KB 以内，图表用 `IntersectionObserver` 等到滚动到附近才下载。如果哪天连这 154KB 也不能接受，只有一个办法——换掉 ECharts，用 ~5KB 的手写 SVG 图表（会偏离原技术栈要求）。

---

## 部署

纯静态，产物在 `dist/`。

**Vercel**：仓库根目录已有 `vercel.json`（构建命令、输出目录、`sw.js` 不缓存），导入仓库即可。

**Netlify**：已有 `netlify.toml`（`npm run build` → `dist`，Node 22，同样的缓存头），导入仓库即可。

**GitHub Pages**（本项目采用的方式）：

```bash
npm run deploy
```

这个脚本会：

1. 用 `VITE_BASE=/<repo-name>/` 构建（base 同时作用于 `manifest.start_url` / `scope` 和 Service Worker 的 `navigateFallback`，否则装不上 PWA）；
2. 把 `dist/` 内容（含 `.nojekyll`）强推到 `gh-pages` 分支。

首次需要在仓库 **Settings → Pages → Source** 选择 **Deploy from a branch**，分支 `gh-pages` / `(root)`。之后每次 `npm run deploy` 直接覆盖更新。

> **为什么不用 Actions 自动部署**：`.github/workflows/ci.yml` 保留了一套「测试 + 构建 + 体积断言」的流程，但默认只支持手动触发（`workflow_dispatch`）。在当前的网络环境里，GitHub Runner 执行 `npm ci` 经常超过 20 分钟甚至卡死，导致 Pages 的 Actions 部署永远等不到构建产物。等安装稳定后，把 `on.push` 打开、并换回 `actions/deploy-pages` 即可。

---

## 测试

```bash
npm test          # 一次性
npm run test:watch
```

39 个用例，覆盖两块最容易出错又最难手测的逻辑：

- `src/utils/retirementMath.test.ts`（23 个）：退休日推算、退休当天 / 已退休的边界、缺口为 0、实际收益率 ≈ 0 的退化、通胀单调性、40 年封顶、缴费指数 0.6~3.0 夹取、月薪为 0、投影序列长度与单调性、工作起点与 16 岁下限、计发月数插值与支出曲线端点。
- `src/utils/exportData.test.ts`（16 个）：备份往返、深拷贝、文件名日期、非 JSON / 非本应用 / 版本过高 / 缺 `data` 的拒绝路径、越界与缺失字段的修复提示、无效计划过滤、重复 id 重新分配、标题裁剪、500 条截断、导入摘要。

测试只跑纯函数，不需要浏览器环境（`vitest.config.ts` 里 `environment: 'node'`）。

---

## 验收清单

- [x] `npm run build` 通过（`vue-tsc` strict 无报错）
- [x] `npm test` 39 个用例全绿
- [x] 首屏 gzip < 200KB
- [x] 首次访问弹三步引导；跳过则载入演示数据
- [x] 刷新后档案、测算值、计划、完成状态全部保留
- [x] 拖拽 / 上下移动改变计划顺序，刷新后保持
- [x] 删除计划有 3 秒「撤销」
- [x] 导出 JSON → 清空 localStorage → 导入覆盖 → 数据完全恢复
- [x] 导入非本应用 JSON 会被拒绝并给出原因
- [x] 重置需输入「重置」二字，重置后立即回到引导
- [x] 弹窗关闭后 `body` 的 `pointer-events` 正常恢复（见下方决策记录）
- [x] Service Worker 接管后**停掉服务器再刷新**，页面仍完整渲染、localStorage 数据仍在
- [ ] 真实断网（DevTools → Network → Offline）+ 硬刷新 —— 需在真实浏览器再走一遍
- [ ] iOS Safari / Android Chrome「添加到主屏幕」

---

## 决策记录

1. **不用 Element Plus**。表单只有十几个字段，组件库的体积（80–120KB gzip）换不来相应收益，且会击穿预算。改用 Tailwind 原子类 + 一个 `reka-ui` Dialog（焦点陷阱和无障碍是真正难写的部分）。
2. **Pinia 用 v3**。`pinia-plugin-persistedstate@4` 的 peer 要求是 `pinia >= 3`。
3. **持久化用 `serializer.deserialize` 做默认值兜底**，而不是 v3 时代的 `merge` 选项（v4 已移除）。
4. **Dialog 动画只在 `data-state="open"` 时挂载**。否则 Reka 的 Presence 在关闭时等不到 `animationend`，弹窗不卸载、`body` 残留 `pointer-events: none`，整页会点不动。这个坑在开发中实际踩到过。
5. **图表视口内加载**，并有 1.5s + scroll 的双重兜底（部分内嵌 WebView 不触发 IntersectionObserver）。
6. **OneDrive 目录下 `fs.rmSync` 会静默失败**，导致 Vite 的 `emptyOutDir` 失效、旧 hash 文件堆积。`scripts/clean.mjs` 改为「先改名再删除」。
7. **不做**：账号、云同步、多语言、亮色主题、拖拽库、i18n 库、表单校验库、任何埋点、任何网络请求。

---

## 免责声明

本工具的测算结果基于简化模型与公开整理的社平工资数据，**不是社保官方口径，不构成财务建议**。真实养老金以社保经办机构核定为准。投资回报假设不代表任何产品的实际收益。
