<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '@/utils/cn'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    hideClose?: boolean
  }>(),
  { size: 'md', description: '', hideClose: false },
)

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const widthClass = computed(
  () =>
    ({
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
    })[props.size],
)
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay
        data-rc-overlay
        class="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm"
      />
      <DialogContent
        data-rc-dialog
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'max-h-[86dvh] overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl',
            widthClass,
          )
        "
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-lg font-semibold text-slate-50">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-xs leading-relaxed text-slate-400">
              {{ description }}
            </DialogDescription>
          </div>
          <button
            v-if="!hideClose"
            type="button"
            class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
            aria-label="关闭"
            @click="emit('update:open', false)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/*
 * 只在 data-state="open" 时挂动画。
 * 否则 Reka 的 Presence 在关闭时会一直等 animationend，导致弹窗不卸载、
 * body 残留 pointer-events: none（整页点不动）。
 */
[data-rc-overlay][data-state='open'] {
  animation: fade-in 180ms ease-out both;
}

[data-rc-dialog][data-state='open'] {
  animation: dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
