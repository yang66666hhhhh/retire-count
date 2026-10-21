<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowUpRight, CircleDollarSign, Plane, Share2 } from 'lucide-vue-next'

interface Slot {
  icon: Component
  title: string
  desc: string
  cta: string
  action: string
}

// MONETIZATION_PLACEHOLDER
// 三个商业化占位插槽。当前仅 console.log，不跳转、不接任何联盟链接、不发请求。
// 上线后若接入真实业务，只需替换本数组与 handleClick，不影响其他组件。
const SLOTS: Slot[] = [
  {
    icon: CircleDollarSign,
    title: '发现退休金缺口？',
    desc: '用个人养老金账户每年最高抵税 ¥5,400',
    cta: '了解',
    action: 'personal-pension-account',
  },
  {
    icon: Plane,
    title: '计划退休后旅居？',
    desc: '看看适老化短租指南，先挑三个城市试住',
    cta: '查看',
    action: 'senior-rental-guide',
  },
  {
    icon: Share2,
    title: '想把蓝图存成海报分享？',
    desc: '升级解锁高清导出，留一张给十年后的自己',
    cta: '解锁',
    action: 'poster-export',
  },
]

function handleClick(action: string) {
  // MONETIZATION_PLACEHOLDER: 仅记录，不做任何网络请求
  console.log('[monetization-placeholder]', action)
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <button
      v-for="slot in SLOTS"
      :key="slot.action"
      type="button"
      class="group flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition-all hover:border-white/15 hover:bg-white/[0.04]"
      @click="handleClick(slot.action)"
    >
      <div class="flex items-center gap-2">
        <component
          :is="slot.icon"
          class="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-200"
        />
        <span class="text-[12.5px] font-medium text-slate-200">{{ slot.title }}</span>
      </div>
      <p class="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">{{ slot.desc }}</p>
      <span class="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-300/80">
        {{ slot.cta }}
        <ArrowUpRight class="h-3 w-3" />
      </span>
    </button>
  </div>

  <p class="mt-2 text-[10.5px] text-slate-600">以上为功能预告，非广告，不收集任何信息。</p>
</template>
