<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    progress: number
    size?: number
    stroke?: number
    tone?: 'emerald' | 'amber' | 'rose'
    showLabel?: boolean
  }>(),
  { size: 168, stroke: 10, tone: 'emerald', showLabel: true },
)

const clamped = computed(() => Math.min(1, Math.max(0, props.progress)))
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circumference.value * (1 - clamped.value))
const percentText = computed(() => `${(clamped.value * 100).toFixed(1)}%`)

const colors = computed(() => {
  switch (props.tone) {
    case 'amber':
      return { from: '#fbbf24', to: '#f59e0b', glow: '#fbbf24' }
    case 'rose':
      return { from: '#fb7185', to: '#e11d48', glow: '#fb7185' }
    default:
      return { from: '#34d399', to: '#10b981', glow: '#34d399' }
  }
})

const gradientId = computed(() => `ring-${props.tone}`)
</script>

<template>
  <div class="relative inline-flex items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" class="-rotate-90" aria-hidden="true">
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="colors.from" />
          <stop offset="100%" :stop-color="colors.to" />
        </linearGradient>
      </defs>
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="rgba(148,163,184,0.12)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`url(#${gradientId})`"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        class="transition-[stroke-dashoffset] duration-700 ease-out"
        :style="{ filter: `drop-shadow(0 0 8px ${colors.glow}55)` }"
      />
    </svg>
    <div v-if="showLabel" class="absolute inset-0 flex flex-col items-center justify-center">
      <slot>
        <span class="font-mono text-2xl font-semibold tabular-nums text-slate-100">{{ percentText }}</span>
        <span class="mt-0.5 text-[11px] tracking-wider text-slate-500">人生进度</span>
      </slot>
    </div>
  </div>
</template>
