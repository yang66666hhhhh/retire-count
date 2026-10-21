<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Check, ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import type { PlanItem } from '@/types'
import type { PlanCategoryMeta } from '@/data/planCategories'
import { cn } from '@/utils/cn'

defineProps<{
  meta: PlanCategoryMeta
  items: PlanItem[]
  draggedId: string | null
}>()

const emit = defineEmits<{
  (e: 'add', title: string): void
  (e: 'toggle', id: string): void
  (e: 'remove', id: string): void
  (e: 'rename', id: string, title: string): void
  (e: 'shift', id: string, delta: number): void
  (e: 'drag-start', id: string): void
  (e: 'drag-end'): void
  (e: 'drop-on-item', targetId: string): void
  (e: 'drop-on-column'): void
}>()

const draft = ref('')
const editingId = ref<string | null>(null)
const editingText = ref('')
const editInput = ref<HTMLInputElement | null>(null)

function submit() {
  const value = draft.value.trim()
  if (!value) return
  emit('add', value)
  draft.value = ''
}

async function startEdit(item: PlanItem) {
  editingId.value = item.id
  editingText.value = item.title
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

function commitEdit() {
  if (!editingId.value) return
  const value = editingText.value.trim()
  if (value) emit('rename', editingId.value, value)
  editingId.value = null
}
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-[220px] flex-col rounded-2xl border p-3.5 transition-colors',
        meta.border,
        meta.bg,
      )
    "
    @dragover.prevent
    @drop="emit('drop-on-column')"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span :class="cn('h-2 w-2 rounded-full', meta.dot)" />
        <h3 :class="cn('text-[13px] font-semibold', meta.text)">{{ meta.label }}</h3>
        <span class="font-mono text-[11px] tabular-nums text-slate-500">
          {{ items.filter((i) => i.done).length }}/{{ items.length }}
        </span>
      </div>
      <span class="text-[10px] uppercase tracking-widest text-slate-600">{{ meta.en }}</span>
    </div>

    <p class="mt-1 text-[10.5px] leading-relaxed text-slate-500">{{ meta.hint }}</p>

    <div class="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        :class="cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', meta.bar)"
        :style="{
          width: items.length ? `${(items.filter((i) => i.done).length / items.length) * 100}%` : '0%',
        }"
      />
    </div>

    <ul class="mt-3 flex-1 space-y-1.5">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        draggable="true"
        :class="
          cn(
            'group flex items-start gap-2 rounded-lg border border-transparent px-1.5 py-1.5 transition-all',
            'hover:border-white/[0.07] hover:bg-white/[0.03]',
            draggedId === item.id && 'opacity-40',
            item.done && 'opacity-55',
          )
        "
        @dragstart.stop="emit('drag-start', item.id)"
        @dragend="emit('drag-end')"
        @dragover.prevent
        @drop.stop="emit('drop-on-item', item.id)"
      >
        <button
          type="button"
          role="checkbox"
          :aria-checked="item.done"
          :aria-label="`标记完成：${item.title}`"
          :class="
            cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all',
              item.done
                ? 'border-emerald-400 bg-emerald-400 text-ink-950'
                : 'border-white/20 hover:border-emerald-400/60',
            )
          "
          @click="emit('toggle', item.id)"
        >
          <Check v-if="item.done" class="h-3 w-3" stroke-width="3" />
        </button>

        <input
          v-if="editingId === item.id"
          ref="editInput"
          v-model="editingText"
          class="min-w-0 flex-1 rounded border border-white/15 bg-ink-950 px-1.5 py-0.5 text-[12px] text-slate-100 outline-none"
          maxlength="120"
          @blur="commitEdit"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc="editingId = null"
        />
        <button
          v-else
          type="button"
          :class="
            cn(
              'min-w-0 flex-1 text-left text-[12px] leading-snug transition-colors',
              item.done ? 'text-slate-500 line-through' : 'text-slate-300 hover:text-white',
            )
          "
          :title="item.title"
          @click="emit('toggle', item.id)"
          @dblclick="startEdit(item)"
        >
          {{ item.title }}
        </button>

        <div
          class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
        >
          <button
            type="button"
            class="rounded p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-25"
            :disabled="index === 0"
            aria-label="上移"
            @click="emit('shift', item.id, -1)"
          >
            <ChevronUp class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="rounded p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-25"
            :disabled="index === items.length - 1"
            aria-label="下移"
            @click="emit('shift', item.id, 1)"
          >
            <ChevronDown class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="cursor-grab rounded p-0.5 text-slate-600 hover:text-slate-300 active:cursor-grabbing"
            aria-label="拖拽排序"
            tabindex="-1"
          >
            <GripVertical class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="rounded p-0.5 text-slate-600 hover:text-rose-400"
            aria-label="删除"
            @click="emit('remove', item.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </li>

      <li v-if="items.length === 0" class="px-1.5 py-6 text-center text-[11px] text-slate-600">
        还没有计划。想到什么就写下来，<br />哪怕只是「学会做一道菜」。
      </li>
    </ul>

    <form class="mt-2 flex items-center gap-1" @submit.prevent="submit">
      <input
        v-model="draft"
        maxlength="120"
        :placeholder="meta.placeholder"
        :class="
          cn(
            'min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-ink-950/50 px-2.5 py-1.5 text-[12px] text-slate-200 focus:border-white/20 focus:outline-none',
            meta.placeholderTone,
          )
        "
      />
      <button
        type="submit"
        class="rounded-lg border border-white/[0.07] bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
        :disabled="!draft.trim()"
        aria-label="添加计划"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
    </form>
  </div>
</template>
