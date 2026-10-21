<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowRight, HardDrive, Hourglass, ShieldCheck, Sparkles } from 'lucide-vue-next'
import CountdownCard from '@/components/CountdownCard.vue'
import IncomeCalculator from '@/components/IncomeCalculator.vue'
import LifePlanBoard from '@/components/LifePlanBoard.vue'
import OnboardingWizard from '@/components/OnboardingWizard.vue'
import BackupModal from '@/components/BackupModal.vue'
import { useUserProfile } from '@/stores/userProfile'
import { useFinancePlan } from '@/stores/financePlan'

const profile = useUserProfile()
const finance = useFinancePlan()

const onboardingOpen = ref(false)
const backupOpen = ref(false)

onMounted(() => {
  if (!profile.onboarded) onboardingOpen.value = true
})

// 重置数据后（onboarded 变回 false）立即重新进入引导，不依赖组件事件
watch(
  () => profile.onboarded,
  (onboarded) => {
    if (!onboarded) onboardingOpen.value = true
  },
)
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-md"
      style="padding-top: env(safe-area-inset-top)"
    >
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-2.5">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-ink-950 shadow-glow"
          >
            <Hourglass class="h-[18px] w-[18px]" stroke-width="2.4" />
          </div>
          <div class="min-w-0">
            <h1 class="truncate text-[15px] font-semibold tracking-tight text-slate-50">
              RetireCount
            </h1>
            <p class="truncate text-[10.5px] text-slate-500">退休倒计时 · 退休生活规划</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="chip hidden sm:inline-flex">
            <ShieldCheck class="h-3 w-3 text-emerald-400" />
            数据只在本机
          </span>
          <button type="button" class="btn-ghost px-3 py-2 text-[12.5px]" @click="backupOpen = true">
            <HardDrive class="h-3.5 w-3.5" />
            备份
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <div
        v-if="profile.isDemo"
        class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3"
      >
        <Sparkles class="h-4 w-4 shrink-0 text-amber-300" />
        <p class="min-w-0 flex-1 text-[12px] leading-relaxed text-amber-100/80">
          现在看到的是<span class="font-medium text-amber-200">演示数据</span>
          （上海 · 1994 年 · 55 岁退休 · 月薪 ¥25,000）。下面的数字不是你的。
        </p>
        <button type="button" class="btn-ghost px-3 py-1.5 text-[12px]" @click="onboardingOpen = true">
          改成我的
          <ArrowRight class="h-3.5 w-3.5" />
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div class="lg:col-span-5">
          <CountdownCard
            :birth-date="profile.birthDate"
            :retire-age="profile.retireAge"
            :years-contributed="finance.yearsContributed"
          />
        </div>
        <div class="lg:col-span-7">
          <IncomeCalculator @edit-profile="onboardingOpen = true" />
        </div>
      </div>

      <LifePlanBoard />

      <footer class="mt-8 flex flex-col items-center gap-2 text-center">
        <p class="text-[11px] leading-relaxed text-slate-600">
          数据只保存在这台设备的 localStorage · 无账号、无服务器、无统计代码
        </p>
        <p class="text-[10.5px] text-slate-700">RetireCount v1.0 · 可离线使用</p>
        <button
          type="button"
          class="text-[10.5px] text-slate-700 underline-offset-2 transition-colors hover:text-slate-400 hover:underline"
          @click="backupOpen = true"
        >
          导入 / 导出 / 重置数据
        </button>
      </footer>
    </main>

    <OnboardingWizard v-model:open="onboardingOpen" />
    <BackupModal v-model:open="backupOpen" />
  </div>
</template>
