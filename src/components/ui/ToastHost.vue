<script setup lang="ts">
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-vue-next'
import { useToasts } from '@/composables/useToast'
import { cn } from '@/utils/cn'

const { items, dismissToast } = useToasts()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-white/10 bg-ink-850/95 px-3.5 py-2.5 shadow-xl backdrop-blur"
      >
        <CheckCircle2 v-if="item.tone === 'success'" class="h-4 w-4 shrink-0 text-emerald-400" />
        <TriangleAlert v-else-if="item.tone === 'danger'" class="h-4 w-4 shrink-0 text-rose-400" />
        <Info v-else class="h-4 w-4 shrink-0 text-sky-400" />
        <span class="flex-1 text-[13px] leading-snug text-slate-200">{{ item.message }}</span>
        <button
          v-if="item.actionLabel"
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/10"
          @click="
            () => {
              item.onAction?.()
              dismissToast(item.id)
            }
          "
        >
          {{ item.actionLabel }}
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
          aria-label="关闭提示"
          @click="dismissToast(item.id)"
        >
          <X class="h-3.5 w-3.5" :class="cn(item.actionLabel && 'hidden sm:block')" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
