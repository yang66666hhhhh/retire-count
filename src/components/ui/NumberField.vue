<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { centsToYuanText } from '@/utils/format'
import { cn } from '@/utils/cn'

const props = withDefaults(
  defineProps<{
    modelValue: number
    /** 显示值 × scale = 存储值。金额 100（元→分），百分比 0.01（3% → 0.03） */
    scale?: number
    min?: number
    max?: number
    decimals?: number
    suffix?: string
    prefix?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: 'md' | 'lg'
  }>(),
  {
    scale: 100,
    min: 0,
    max: 100_000_000_000,
    decimals: 0,
    suffix: '',
    prefix: '',
    placeholder: '',
    disabled: false,
    invalid: false,
    size: 'md',
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()

const focused = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function formatDisplay(storage: number): string {
  const display = storage / props.scale
  if (props.decimals === 0) return centsToYuanText(display * 100)
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: props.decimals,
  }).format(display)
}

const displayText = computed(() => formatDisplay(props.modelValue))

watch(
  () => props.modelValue,
  () => {
    if (!focused.value) draft.value = displayText.value
  },
  { immediate: true },
)

function clampValue(value: number): number {
  const safe = Number.isFinite(value) ? value : props.min
  return Math.min(props.max, Math.max(props.min, safe))
}

function onFocus() {
  focused.value = true
  draft.value = displayText.value.replace(/,/g, '')
  requestAnimationFrame(() => inputEl.value?.select())
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value.replace(/[^\d.]/g, '')
  draft.value = raw
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    emit('update:modelValue', props.min)
    return
  }
  emit('update:modelValue', clampValue(parsed * props.scale))
}

function onBlur() {
  focused.value = false
  draft.value = displayText.value
}
</script>

<template>
  <div
    :class="
      cn(
        'group flex items-center gap-1.5 rounded-xl border bg-ink-950/60 px-3.5 transition-colors',
        size === 'lg' ? 'py-3' : 'py-2.5',
        invalid
          ? 'border-rose-500/60'
          : 'border-white/10 hover:border-white/20 focus-within:border-emerald-400/60',
        disabled && 'opacity-50',
      )
    "
  >
    <span v-if="prefix" class="shrink-0 text-sm text-slate-500">{{ prefix }}</span>
    <input
      ref="inputEl"
      :value="draft"
      :placeholder="placeholder"
      :disabled="disabled"
      inputmode="decimal"
      autocomplete="off"
      :class="
        cn(
          'min-w-0 flex-1 bg-transparent font-mono tabular-nums text-slate-100 placeholder:font-sans placeholder:text-slate-600 focus:outline-none',
          size === 'lg' ? 'text-lg' : 'text-sm',
        )
      "
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
    />
    <span v-if="suffix" class="shrink-0 text-xs text-slate-500">{{ suffix }}</span>
  </div>
</template>
