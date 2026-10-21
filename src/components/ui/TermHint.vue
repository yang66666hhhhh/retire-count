<script setup lang="ts">
import { Info } from 'lucide-vue-next'

defineProps<{
  title: string
  text: string
}>()
</script>

<template>
  <details class="relative ml-0.5 inline-block align-middle">
    <summary
      class="inline-flex cursor-pointer list-none items-center rounded text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-400/60"
      :aria-label="`解释：${title}`"
    >
      <Info class="h-3 w-3" />
    </summary>
    <div
      class="absolute left-1/2 top-full z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-ink-900 p-3 text-[11px] font-normal leading-relaxed text-slate-400 shadow-xl shadow-black/40"
    >
      <p class="mb-1 font-medium text-slate-200">{{ title }}</p>
      {{ text }}
    </div>
  </details>
</template>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}
</style>
