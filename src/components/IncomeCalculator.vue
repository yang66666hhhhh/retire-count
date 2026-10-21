<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ChevronDown,
  Info,
  MapPin,
  Pencil,
  ShieldAlert,
  Sparkles,
} from 'lucide-vue-next'
import NumberField from './ui/NumberField.vue'
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

const replaceRate = computed(() =>
  finance.monthlySalary > 0 ? result.value.estimatedMonthlyPension / finance.monthlySalary : 0,
)

const gapBarWidth = computed(() =>
  finance.monthlyTargetExpense > 0
    ? Math.min(100, (result.value.monthlyGap / finance.monthlyTargetExpense) * 100)
    : 0,
)

const hasGap = computed(() => result.value.totalGapAtRetirement > 0)
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

const stats = computed(() => [
  {
    label: '退休后预计月养老金',
    value: formatCents(result.value.estimatedMonthlyPension),
    note: `替代率 ${formatPercent(replaceRate.value)}`,
    tone: 'emerald' as const,
  },
  {
    label: '退休时点缺口现值',
    value: formatCents(result.value.totalGapAtRetirement),
    note: '30 年、今日购买力',
    tone: 'amber' as const,
  },
  {
    label: '现在每月需额外储蓄',
    value: formatCents(result.value.monthlyNeedToSave),
    note: result.value.monthsUntilRetirement > 0 ? '按实际收益率摊平' : '已到退休节点',
    tone: 'sky' as const,
  },
])
</script>

<template>
  <section class="card card-pad animate-fade-up" aria-label="退休金测算" style="animation-delay: 60ms">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-slate-100">退休金测算</h2>
        <p class="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
          <MapPin class="h-3 w-3" />
          {{ profile.cityInfo.name }} · 社平 ¥{{ profile.cityInfo.avgSalary.toLocaleString('zh-CN') }}/月
          <span class="text-slate-700">|</span>
          按今日购买力计算
        </p>
      </div>
      <button
        type="button"
        class="btn-quiet -mr-2 -mt-1 px-2 py-1.5 text-[12px]"
        @click="emit('editProfile')"
      >
        <Pencil class="h-3.5 w-3.5" />
        改档案
      </button>
    </header>

    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label class="label" for="f-salary">现在月薪（税前）</label>
        <NumberField id="f-salary" v-model="finance.monthlySalary" prefix="¥" suffix="元/月" :max="100_000_000" />
      </div>
      <div>
        <label class="label" for="f-years">已缴社保年限</label>
        <NumberField id="f-years" v-model="finance.yearsContributed" :scale="1" :max="40" suffix="年" />
      </div>
      <div>
        <label class="label" for="f-target">退休后每月目标支出</label>
        <NumberField id="f-target" v-model="finance.monthlyTargetExpense" prefix="¥" suffix="元/月" :max="100_000_000" />
      </div>
      <div>
        <label class="label" for="f-balance">个人账户现有余额（可选）</label>
        <NumberField
          id="f-balance"
          v-model="finance.personalAccountBalance"
          prefix="¥"
          suffix="留空自动估算"
          :max="100_000_000"
        />
      </div>
      <div>
        <label class="label" for="f-inflation">长期通胀率</label>
        <NumberField id="f-inflation" v-model="finance.inflationRate" :scale="0.01" :decimals="1" :max="0.2" suffix="%" />
      </div>
      <div>
        <label class="label" for="f-return">退休前投资年化</label>
        <NumberField id="f-return" v-model="finance.investmentReturn" :scale="0.01" :decimals="1" :max="0.25" suffix="%" />
      </div>
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
        <p class="text-[11px] text-slate-400">{{ stat.label }}</p>
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

    <div class="mt-4 rounded-xl border border-white/[0.06] bg-ink-950/40 p-3.5">
      <div class="flex items-center justify-between text-[11.5px]">
        <span class="text-slate-400">每月缺口占目标支出的比例</span>
        <span class="font-mono tabular-nums text-slate-200">{{ gapBarWidth.toFixed(0) }}%</span>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          class="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-[width] duration-500"
          :style="{ width: `${gapBarWidth}%` }"
        />
      </div>
      <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
        <template v-if="hasGap">
          退休后每月大约差 <span class="text-amber-300">{{ formatCents(result.monthlyGap) }}</span>，
          30 年累计折现约 <span class="text-amber-300">{{ formatCents(result.totalGapAtRetirement) }}</span>。
        </template>
        <template v-else>
          按当前参数，养老金已能覆盖你的目标支出。可以试着把目标支出调高，看看安全边际还有多少。
        </template>
      </p>
    </div>

    <div class="mt-5">
      <div class="mb-2 flex items-end justify-between">
        <div>
          <h3 class="text-[13px] font-medium text-slate-200">退休后 30 年，钱够不够用</h3>
          <p class="mt-0.5 text-[11px] text-slate-500">缺口随时间放大：支出有微笑曲线，养老金购买力在缓慢缩水</p>
        </div>
      </div>
      <div class="mb-1.5 flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-amber-400" />目标支出
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-emerald-400" />养老金
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-2 rounded-full bg-rose-400" />缺口
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
      <p class="mt-1 text-[10.5px] leading-relaxed text-slate-600">
        假设：支出按「活跃期 1.0 → 平稳期 0.92 → 护理期 1.3」变化；养老金调整幅度低于通胀 15%。
      </p>
    </div>

    <button
      type="button"
      class="mt-4 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
      @click="showProcess = !showProcess"
    >
      <span class="flex items-center gap-1.5">
        <Info class="h-3.5 w-3.5" />
        计算过程与假设
      </span>
      <ChevronDown :class="cn('h-3.5 w-3.5 transition-transform', showProcess && 'rotate-180')" />
    </button>

    <div v-if="showProcess" class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-ink-950/50 p-4 text-[11.5px]">
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
      <p class="col-span-2 mt-1 border-t border-white/[0.06] pt-2 text-[10.5px] leading-relaxed text-slate-600">
        基础养老金 = 社平工资 × (1 + 缴费指数) ÷ 2 × 缴费年限 × 1%；个人账户 = 账户余额 ÷ 计发月数。
        账户余额按 2% 实际记账利率累积。模型为简化估算，非社保官方口径。
      </p>
    </div>

    <div class="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] px-3 py-2.5 text-[10.5px] leading-relaxed text-slate-500">
      <ShieldAlert class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span>
        本页所有数字都是简化模型下的估算，不构成财务建议。真实养老金以社保经办机构核定为准；
        投资回报假设不代表任何产品的实际收益。
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
