<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, Hourglass, PartyPopper } from 'lucide-vue-next'
import { useCountdown } from '@/composables/useCountdown'
import { computeRetireDate, computeWorkStart } from '@/utils/retirementMath'
import { formatDateCN, formatDays, pad2 } from '@/utils/format'
import ProgressRing from './ui/ProgressRing.vue'

const props = defineProps<{
  birthDate: string
  retireAge: number
  yearsContributed: number
}>()

const retireDate = computed(() => computeRetireDate(props.birthDate, props.retireAge))
const workStart = computed(() =>
  computeWorkStart(props.birthDate, props.retireAge, props.yearsContributed),
)

const { now, isRetired, days, hours, minutes, seconds } = useCountdown(() => retireDate.value)

const retiredDays = computed(() =>
  Math.max(0, Math.floor((now.value - retireDate.value.getTime()) / 86_400_000)),
)

const progress = computed(() => {
  const total = retireDate.value.getTime() - workStart.value.getTime()
  if (total <= 0) return 1
  const passed = now.value - workStart.value.getTime()
  return Math.min(1, Math.max(0, passed / total))
})

const workedYears = computed(() => {
  const ms = now.value - workStart.value.getTime()
  return Math.max(0, ms / (365.2425 * 86_400_000))
})

const milestone = computed(() => {
  const left = days.value
  if (isRetired.value) return '退休生活进行中'
  if (left <= 30) return `只剩 ${left} 天，交接清单该收尾了`
  if (left <= 100) return '不足 100 天，开始安排退休后的第一周吧'
  if (left <= 1000) return '已进入最后 1000 天，可以开始算细账了'
  if (left <= 3650) return '还有 10 年以内，现在规划刚刚好'
  return '时间还宽裕，越早开始越轻松'
})
</script>

<template>
  <section
    class="card card-pad relative overflow-hidden animate-fade-up"
    aria-label="退休倒计时"
  >
    <div
      class="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
    />

    <div class="relative flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-400">
          <Hourglass class="h-3.5 w-3.5 text-emerald-400" />
          <span>{{ isRetired ? '退休生活已开始' : '距离退休还有' }}</span>
        </div>

        <div class="mt-3 flex items-end gap-2">
          <span
            class="stat-value text-[3.4rem] font-black leading-none sm:text-[4.2rem]"
            aria-live="off"
          >
            {{ isRetired ? formatDays(retiredDays) : formatDays(days) }}
          </span>
          <span class="pb-2 text-base font-medium text-slate-400">
            {{ isRetired ? '天' : '天' }}
          </span>
        </div>

        <div v-if="!isRetired" class="mt-3 flex items-center gap-2 font-mono text-lg tabular-nums text-slate-300">
          <span class="rounded-lg bg-white/[0.04] px-2 py-1">{{ pad2(hours) }}</span>
          <span class="text-slate-600">:</span>
          <span class="rounded-lg bg-white/[0.04] px-2 py-1">{{ pad2(minutes) }}</span>
          <span class="text-slate-600">:</span>
          <span class="rounded-lg bg-white/[0.04] px-2 py-1 text-emerald-300">{{ pad2(seconds) }}</span>
          <span class="ml-1 font-sans text-[11px] text-slate-500">时 · 分 · 秒</span>
        </div>

        <div v-else class="mt-3 flex items-center gap-1.5 text-sm text-emerald-300">
          <PartyPopper class="h-4 w-4" />
          <span>恭喜，你已经自由 {{ formatDays(retiredDays) }} 天</span>
        </div>
      </div>

      <ProgressRing
        :progress="progress"
        :size="132"
        :stroke="9"
        :tone="isRetired ? 'emerald' : 'emerald'"
        class="hidden shrink-0 sm:block"
      >
        <span class="font-mono text-xl font-semibold tabular-nums text-slate-100">
          {{ (progress * 100).toFixed(1) }}%
        </span>
        <span class="mt-0.5 text-[10px] tracking-wider text-slate-500">工作阶段</span>
      </ProgressRing>
    </div>

    <div class="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[13px] text-slate-400">
      <CalendarDays class="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span class="truncate">
        退休日 <span class="text-slate-200">{{ formatDateCN(retireDate) }}</span>
        <span class="mx-1.5 text-slate-600">·</span>
        已工作 <span class="text-slate-200">{{ workedYears.toFixed(1) }}</span> 年
      </span>
    </div>

    <p class="mt-2 text-[12px] leading-relaxed text-amber-200/70">{{ milestone }}</p>
  </section>
</template>
