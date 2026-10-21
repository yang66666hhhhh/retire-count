<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Calculator,
  ChevronDown,
  MapPin,
  Pencil,
  Settings2,
  ShieldAlert,
  Sparkles,
} from 'lucide-vue-next'
import NumberField from './ui/NumberField.vue'
import TermHint from './ui/TermHint.vue'
import MonetizeSlot from './MonetizeSlot.vue'
import { useUserProfile } from '@/stores/userProfile'
import { useFinancePlan } from '@/stores/financePlan'
import { computeRetirement } from '@/utils/retirementMath'
import { payoutMonths } from '@/data/cities'
import { formatCents, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'

const GapChart = defineAsyncComponent(() => import('./GapChart.vue'))

const emit = defineEmits<{ (e: 'editProfile'): void }>()

const profile = useUserProfile()
const finance = useFinancePlan()

/** 每 60 秒刷新一次「距离退休」，让天数在长时间挂起后也准确 */
const nowTick = ref(Date.now())
const timer = window.setInterval(() => (nowTick.value = Date.now()), 60_000)
onBeforeUnmount(() => window.clearInterval(timer))

const result = computed(() =>
  computeRetirement({
    birthDate: profile.birthDate,
    retireAge: profile.retireAge,
    monthlySalary: finance.monthlySalary,
    yearsContributed: finance.yearsContributed,
    monthlyTargetExpense: finance.monthlyTargetExpense,
    inflationRate: finance.inflationRate,
    investmentReturn: finance.investmentReturn,
    personalAccountBalance: finance.personalAccountBalance,
    cityAvgSalary: profile.cityAvgSalaryCents,
    now: new Date(nowTick.value),
  }),
)

/** 养老金相当于现在工资的比例（替代率），用人话展示 */
const replaceRate = computed(() =>
  finance.monthlySalary > 0 ? result.value.estimatedMonthlyPension / finance.monthlySalary : 0,
)

const hasGap = computed(() => result.value.totalGapAtRetirement > 0)

/** 目标支出里，社保能覆盖多少（可能超过 100%，展示时封顶） */
const coverage = computed(() => {
  if (finance.monthlyTargetExpense <= 0) return 100
  return Math.min(100, (result.value.estimatedMonthlyPension / finance.monthlyTargetExpense) * 100)
})
const gapShare = computed(() => Math.max(0, 100 - coverage.value))
const surplus = computed(() =>
  Math.max(0, result.value.estimatedMonthlyPension - finance.monthlyTargetExpense),
)

const realReturnPercent = computed(
  () => `${Math.round(finance.investmentReturn * 1000) / 10}%`,
)

const verdictText = computed(() => {
  const pension = formatCents(result.value.estimatedMonthlyPension)
  const target = formatCents(finance.monthlyTargetExpense)

  if (finance.monthlyTargetExpense <= 0) {
    return '先把「退休后每月目标支出」填上，下面三个数字才有意义。'
  }
  if (hasGap.value) {
    if (result.value.monthsUntilRetirement > 0) {
      return `你 ${profile.retireAge} 岁退休后，社保每月大约发 ${pension}；想花 ${target}，每月差 ${formatCents(result.value.monthlyGap)}。`
    }
    return `按现在参数，你每月能领 ${pension}，比目标支出 ${target} 少 ${formatCents(result.value.monthlyGap)}。`
  }
  return `按现在参数，退休后社保每月 ${pension}，够覆盖 ${target} 的目标支出${
    surplus.value > 0 ? `，还能剩 ${formatCents(surplus.value)}` : ''
  }。`
})

const actionText = computed(() => {
  if (finance.monthlyTargetExpense <= 0) return '填好目标支出后，这里会告诉你每月要存多少。'
  if (!hasGap.value) return '不用额外存钱。建议再留 6–12 个月生活费作为应急金，剩下的可以放心花。'
  if (result.value.monthsUntilRetirement <= 0) {
    return '已经到退休节点，这个缺口要靠已有存款和资产来补。'
  }
  return `想补上：从今天起每月存 ${formatCents(result.value.monthlyNeedToSave)}，按年化 ${realReturnPercent.value} 算，到退休正好攒够。`
})

const stats = computed(() => [
  {
    label: '社保每月发',
    value: formatCents(result.value.estimatedMonthlyPension),
    note:
      finance.monthlySalary > 0
        ? `≈ 现在工资的 ${formatPercent(replaceRate.value)}`
        : '按社平工资估算',
    tone: 'emerald' as const,
    hint: {
      title: '社保养老金',
      text: '= 基础养老金 + 个人账户养老金。按你填的工资、缴费年限和当地社平工资估算，不是社保局的核定结果。',
    },
  },
  {
    label: '退休时还差',
    value: formatCents(result.value.totalGapAtRetirement),
    note: '按今天的钱算 · 覆盖退休后 30 年',
    tone: 'amber' as const,
    hint: {
      title: '为什么是一个「一次性」的数',
      text: '把退休后 30 年里每个月的缺口，按实际收益率折算回退休那一天，得到的总金额。它回答的是：退休那天账户里要多出多少钱。',
    },
  },
  {
    label: '现在每月存',
    value: formatCents(result.value.monthlyNeedToSave),
    note:
      result.value.monthsUntilRetirement > 0
        ? `按年化 ${realReturnPercent.value} 存到退休`
        : '已到退休节点',
    tone: 'sky' as const,
    hint: {
      title: '每月存多少才够',
      text: '把上面的总缺口，按你设定的年化收益，摊到退休前的每个月。开始得越早，每月要存的钱越少。',
    },
  },
])

const showAdvanced = ref(false)
const showProcess = ref(false)

/**
 * 图表按需加载：滚动到可见区域附近才请求 ECharts chunk（约 150KB gzip）。
 * 首屏因此只加载应用本体。
 */
const chartHost = ref<HTMLElement | null>(null)
const chartVisible = ref(false)
let io: IntersectionObserver | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

function revealIfInViewport() {
  const rect = chartHost.value?.getBoundingClientRect()
  if (!rect) return
  if (rect.top < window.innerHeight + 300 && rect.bottom > -300) {
    chartVisible.value = true
  }
}

function onScrollFallback() {
  revealIfInViewport()
  if (chartVisible.value) window.removeEventListener('scroll', onScrollFallback)
}

onMounted(() => {
  if (!chartHost.value) return
  if (!('IntersectionObserver' in window)) {
    chartVisible.value = true
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        chartVisible.value = true
        io?.disconnect()
        io = null
      }
    },
    { rootMargin: '240px 0px' },
  )
  io.observe(chartHost.value)

  // 兜底：某些内嵌 WebView / 隐藏窗口不会触发 IO 回调
  fallbackTimer = setTimeout(revealIfInViewport, 1500)
  window.addEventListener('scroll', onScrollFallback, { passive: true })
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = null
  window.removeEventListener('scroll', onScrollFallback)
})
</script>

<template>
  <section class="card card-pad animate-fade-up" aria-label="退休金测算" style="animation-delay: 60ms">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-slate-100">退休后钱够花吗</h2>
        <p class="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
          <MapPin class="h-3 w-3" />
          {{ profile.cityInfo.name }} · 社平 ¥{{ profile.cityInfo.avgSalary.toLocaleString('zh-CN') }}/月
          <TermHint
            title="社平工资"
            text="当地上一年度职工的月平均工资，是社保缴费和养老金计算的基准。这里用的是公开资料里的参考值。"
          />
          <span class="text-slate-700">|</span>
          金额都按「今天的购买力」显示
          <TermHint
            title="今日购买力"
            text="把未来的钱按通胀折算成今天的钱。这样 30 年后的 1 万元，会和今天的 1 万元一样好比较。"
          />
        </p>
      </div>
      <button
        type="button"
        class="btn-quiet -mr-2 -mt-1 px-2 py-1.5 text-[12px]"
        @click="emit('editProfile')"
      >
        <Pencil class="h-3.5 w-3.5" />
        改我的信息
      </button>
    </header>

    <!-- 先给结论，再给数字 -->
    <div
      :class="
        cn(
          'mt-4 rounded-xl border p-4',
          hasGap
            ? 'border-amber-400/20 bg-amber-400/[0.06]'
            : 'border-emerald-400/20 bg-emerald-400/[0.06]',
        )
      "
    >
      <p
        :class="
          cn(
            'text-[11px] font-medium tracking-wide',
            hasGap ? 'text-amber-300/90' : 'text-emerald-300/90',
          )
        "
      >
        一句话结论
      </p>
      <p class="mt-1.5 text-[13.5px] leading-relaxed text-slate-100">{{ verdictText }}</p>
      <p
        :class="
          cn(
            'mt-1.5 text-[12px] leading-relaxed',
            hasGap ? 'text-amber-200/75' : 'text-emerald-200/75',
          )
        "
      >
        {{ actionText }}
      </p>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label class="label" for="f-salary">现在月薪（税前）</label>
        <NumberField id="f-salary" v-model="finance.monthlySalary" prefix="¥" suffix="元/月" :max="100_000_000" />
      </div>
      <div>
        <label class="label" for="f-years">已缴社保年限</label>
        <NumberField id="f-years" v-model="finance.yearsContributed" :scale="1" :max="40" suffix="年" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="f-target">退休后每月想花多少（按今天物价）</label>
        <NumberField id="f-target" v-model="finance.monthlyTargetExpense" prefix="¥" suffix="元/月" :max="100_000_000" />
        <p class="mt-1 text-[10.5px] text-slate-600">
          拿现在的月支出打 7–9 折估就行；这个数直接决定缺口大小。
        </p>
      </div>
    </div>

    <button
      type="button"
      class="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
      @click="showAdvanced = !showAdvanced"
    >
      <span class="flex items-center gap-1.5">
        <Settings2 class="h-3.5 w-3.5" />
        高级设置（不确定就不用改）
      </span>
      <ChevronDown :class="cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')" />
    </button>

    <div v-if="showAdvanced" class="mt-2 grid grid-cols-1 gap-3 rounded-xl bg-ink-950/40 p-3.5 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class="label" for="f-balance">
          个人账户现有余额
          <TermHint
            title="个人账户余额"
            text="社保个人账户里已经攒下的钱。查不到就填 0，页面会按你的工资和缴费年限自动估算。"
          />
        </label>
        <NumberField
          id="f-balance"
          v-model="finance.personalAccountBalance"
          prefix="¥"
          suffix="不知道填 0"
          :max="100_000_000"
        />
      </div>
      <div>
        <label class="label" for="f-inflation">
          长期通胀率
          <TermHint
            title="通胀率"
            text="物价每年上涨的速度。长期中性假设是 3% 左右；调高会让未来的钱更不值钱，缺口看起来更大。"
          />
        </label>
        <NumberField id="f-inflation" v-model="finance.inflationRate" :scale="0.01" :decimals="1" :max="0.2" suffix="%" />
      </div>
      <div>
        <label class="label" for="f-return">
          退休前投资年化
          <TermHint
            title="投资年化"
            text="你打算用来补缺口的钱，每年大概能赚多少。5% 是长期中性假设；这里填的是「名义收益」，页面会自动扣掉通胀。"
          />
        </label>
        <NumberField id="f-return" v-model="finance.investmentReturn" :scale="0.01" :decimals="1" :max="0.25" suffix="%" />
      </div>
      <p class="sm:col-span-2 text-[10.5px] leading-relaxed text-slate-600">
        账户余额填 0 = 按工资自动估算；通胀 3%、年化 5% 是长期中性值。不确定就保持默认。
      </p>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        :class="
          cn(
            'rounded-xl border p-3.5',
            stat.tone === 'emerald' && 'border-emerald-400/15 bg-emerald-400/[0.05]',
            stat.tone === 'amber' && 'border-amber-400/15 bg-amber-400/[0.05]',
            stat.tone === 'sky' && 'border-sky-400/15 bg-sky-400/[0.05]',
          )
        "
      >
        <p class="flex items-center text-[11px] text-slate-400">
          {{ stat.label }}
          <TermHint :title="stat.hint.title" :text="stat.hint.text" />
        </p>
        <p
          :class="
            cn(
              'stat-value mt-1.5 text-[22px] font-bold leading-tight',
              stat.tone === 'emerald' && 'text-emerald-300',
              stat.tone === 'amber' && 'text-amber-300',
              stat.tone === 'sky' && 'text-sky-300',
            )
          "
        >
          {{ stat.value }}
        </p>
        <p class="mt-1 text-[10.5px] text-slate-500">{{ stat.note }}</p>
      </div>
    </div>

    <!-- 用「钱从哪里来」代替百分比进度条，更好懂 -->
    <div class="mt-4 rounded-xl border border-white/[0.06] bg-ink-950/40 p-3.5">
      <div class="flex flex-wrap items-center justify-between gap-1 text-[11.5px]">
        <span class="text-slate-400">退休后每月 {{ formatCents(finance.monthlyTargetExpense) }}，钱从哪里来</span>
        <span class="text-slate-500">
          社保 <span class="text-emerald-300">{{ coverage.toFixed(0) }}%</span>
          · 自己 <span class="text-rose-300">{{ gapShare.toFixed(0) }}%</span>
        </span>
      </div>
      <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          class="h-full bg-emerald-400/80 transition-[width] duration-500"
          :style="{ width: `${coverage}%` }"
        />
        <div
          class="h-full bg-rose-400/80 transition-[width] duration-500"
          :style="{ width: `${gapShare}%` }"
        />
      </div>
      <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
        <template v-if="hasGap">
          社保能覆盖 {{ coverage.toFixed(0) }}%（{{ formatCents(result.estimatedMonthlyPension) }}），
          剩下 {{ formatCents(result.monthlyGap) }} 得自己补。
        </template>
        <template v-else>
          社保已经够覆盖，每月还能结余 {{ formatCents(surplus) }}。
        </template>
      </p>
    </div>

    <div class="mt-5">
      <div class="mb-2">
        <h3 class="text-[13px] font-medium text-slate-200">退休后每年：想花多少 vs 社保发多少</h3>
        <p class="mt-0.5 text-[11px] text-slate-500">红色越宽，说明那一年自己要补的钱越多</p>
      </div>
      <div class="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slate-400">
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-amber-400" />橙色虚线 = 想花的钱
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-emerald-400" />绿色 = 社保发的
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-rose-400" />红色 = 自己要补的
        </span>
      </div>
      <div ref="chartHost" class="-mx-1 overflow-x-auto px-1 pb-1">
        <div class="min-w-[520px]">
          <GapChart v-if="chartVisible" :series="result.projectionSeries" />
          <div v-else class="flex h-[260px] w-full items-center justify-center sm:h-[300px]">
            <span class="text-[11px] text-slate-600">图表准备中…</span>
          </div>
        </div>
      </div>
      <p class="mt-1 text-[10.5px] leading-relaxed text-slate-500">
        怎么看：横轴是年龄，往右走红色会变宽——65 岁后护理开销上涨，而养老金涨幅通常慢于物价。
        这里假设 65 岁后支出涨到 1.3 倍、养老金每年涨幅比物价低 15%。
      </p>
    </div>

    <button
      type="button"
      class="mt-4 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
      @click="showProcess = !showProcess"
    >
      <span class="flex items-center gap-1.5">
        <Calculator class="h-3.5 w-3.5" />
        这些数字是怎么算出来的？
      </span>
      <ChevronDown :class="cn('h-3.5 w-3.5 transition-transform', showProcess && 'rotate-180')" />
    </button>

    <div v-if="showProcess" class="mt-2 space-y-3 rounded-xl bg-ink-950/50 p-4 text-[11.5px] leading-relaxed text-slate-400">
      <div class="space-y-1.5">
        <p><span class="text-slate-200">① 社保养老金</span> = 基础养老金 + 个人账户养老金。</p>
        <p><span class="text-slate-200">② 基础养老金</span> ≈ 社平工资 × (1 + 缴费指数) ÷ 2 × 缴费年限 × 1%。</p>
        <p><span class="text-slate-200">③ 个人账户养老金</span> = 账户余额 ÷ 计发月数（60 岁退休按 139 个月发）。</p>
        <p><span class="text-slate-200">④ 统一折算</span>：所有金额都换成「今天的购买力」，可以直接和现在的工资对比。</p>
      </div>

      <details class="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <summary class="cursor-pointer text-[11.5px] text-slate-300">看具体参数</summary>
        <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          <div class="flex justify-between gap-2 text-slate-500">
            <span>总缴费年限</span>
            <span class="font-mono text-slate-300">{{ result.totalContributionYears.toFixed(1) }} 年</span>
          </div>
          <div class="flex justify-between gap-2 text-slate-500">
            <span>缴费指数</span>
            <span class="font-mono text-slate-300">{{ result.contributionIndex.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between gap-2 text-slate-500">
            <span>基础养老金</span>
            <span class="font-mono text-slate-300">{{ formatCents(result.basicPension) }}</span>
          </div>
          <div class="flex justify-between gap-2 text-slate-500">
            <span>个人账户养老金</span>
            <span class="font-mono text-slate-300">{{ formatCents(result.accountPension) }}</span>
          </div>
          <div class="flex justify-between gap-2 text-slate-500">
            <span>计发月数</span>
            <span class="font-mono text-slate-300">{{ payoutMonths(profile.retireAge) }} 个月</span>
          </div>
          <div class="flex justify-between gap-2 text-slate-500">
            <span>实际年化收益</span>
            <span class="font-mono text-slate-300">{{ formatPercent(result.realReturn, 2) }}</span>
          </div>
        </div>
      </details>

      <details class="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <summary class="cursor-pointer text-[11.5px] text-slate-300">术语小词典（6 个词）</summary>
        <dl class="mt-2 space-y-2">
          <div>
            <dt class="text-slate-300">社平工资</dt>
            <dd>当地上一年度职工月平均工资，是社保缴费和养老金计算的基准。</dd>
          </div>
          <div>
            <dt class="text-slate-300">缴费指数</dt>
            <dd>你的缴费工资 ÷ 社平工资。工资越高指数越高，一般在 0.6–3 之间。</dd>
          </div>
          <div>
            <dt class="text-slate-300">计发月数</dt>
            <dd>个人账户余额分多少个月发完。退休越晚，月数越少，每月领得越多。</dd>
          </div>
          <div>
            <dt class="text-slate-300">替代率</dt>
            <dd>养老金 ÷ 退休前工资。国际经验认为到 70% 左右，退休后生活才比较体面。</dd>
          </div>
          <div>
            <dt class="text-slate-300">今日购买力</dt>
            <dd>把未来的钱按通胀折算成今天的钱，避免「30 年后的 1 万」看着多、其实不值钱。</dd>
          </div>
          <div>
            <dt class="text-slate-300">实际收益率</dt>
            <dd>投资回报减去通胀，衡量钱真正变快的速度。</dd>
          </div>
        </dl>
      </details>
    </div>

    <div class="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] px-3 py-2.5 text-[10.5px] leading-relaxed text-slate-500">
      <ShieldAlert class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span>
        简化估算，不是社保局的核定结果，也不构成理财建议。真实养老金以社保经办机构核定为准。
      </span>
    </div>

    <div class="mt-5 border-t border-white/[0.06] pt-4">
      <p class="mb-2.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Sparkles class="h-3 w-3 text-emerald-400/70" />
        算完缺口，顺便看看这几件事
      </p>
      <MonetizeSlot />
    </div>
  </section>
</template>
