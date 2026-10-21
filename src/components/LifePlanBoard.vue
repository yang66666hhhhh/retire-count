<script setup lang="ts">
import { ref } from 'vue'
import { Compass, RotateCcw } from 'lucide-vue-next'
import PlanBucket from './PlanBucket.vue'
import { PLAN_CATEGORIES } from '@/data/planCategories'
import { useLifePlans } from '@/stores/lifePlans'
import { pushToast } from '@/composables/useToast'
import type { PlanCategory } from '@/types'

const store = useLifePlans()
const draggedId = ref<string | null>(null)

function handleAdd(category: PlanCategory, title: string) {
  store.addPlan(category, title)
}

function handleRemove(id: string) {
  const removed = store.removePlan(id)
  if (!removed) return
  pushToast('已删除一条计划', {
    actionLabel: '撤销',
    onAction: () => store.restorePlan(removed),
  })
}

function handleDrop(targetId: string | null, category: PlanCategory) {
  if (!draggedId.value) return
  if (draggedId.value !== targetId) {
    store.movePlan(draggedId.value, targetId, category)
  }
  draggedId.value = null
}

function handleShift(id: string, delta: number) {
  store.shiftPlan(id, delta)
}

function resetDemo() {
  store.reset()
  pushToast('蓝图已恢复为演示内容', { tone: 'success' })
}
</script>

<template>
  <section class="card card-pad mt-4 animate-fade-up" aria-label="退休生活蓝图" style="animation-delay: 120ms">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <Compass class="h-4 w-4 text-slate-400" />
          <h2 class="text-base font-semibold text-slate-100">退休生活蓝图</h2>
          <span class="chip">
            完成 {{ store.doneCount }} / {{ store.totalCount }}
          </span>
        </div>
        <p class="mt-1 text-[12px] text-slate-500">
          退休不只是钱的事。四块拼图都写上几笔，那天到来时才不会空落落的。
        </p>
      </div>
      <button type="button" class="btn-quiet px-2 py-1.5 text-[11.5px]" @click="resetDemo">
        <RotateCcw class="h-3 w-3" />
        恢复演示内容
      </button>
    </header>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <PlanBucket
        v-for="meta in PLAN_CATEGORIES"
        :key="meta.key"
        :meta="meta"
        :items="store.byCategory(meta.key)"
        :dragged-id="draggedId"
        @add="(title) => handleAdd(meta.key, title)"
        @toggle="store.togglePlan"
        @remove="handleRemove"
        @rename="store.renamePlan"
        @shift="handleShift"
        @drag-start="(id) => (draggedId = id)"
        @drag-end="draggedId = null"
        @drop-on-item="(targetId) => handleDrop(targetId, meta.key)"
        @drop-on-column="handleDrop(null, meta.key)"
      />
    </div>
  </section>
</template>
