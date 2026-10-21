import { defineStore } from 'pinia'
import type { LifePlansState, PlanCategory, PlanItem } from '@/types'
import { deepMerge, localStore, makeSerializer, PERSIST_PREFIX } from './index'

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface SeedPlan {
  category: PlanCategory
  title: string
}

const SEED: SeedPlan[] = [
  { category: 'finance', title: '算清每月养老金缺口，定一个补充储蓄目标' },
  { category: 'finance', title: '开通个人养老金账户，每年顶格存入 ¥12,000' },
  { category: 'health', title: '每周三次力量训练，护住膝盖和腰' },
  { category: 'health', title: '做一次全面体检，把慢病指标记下来' },
  { category: 'hobby', title: '学一门能玩到 80 岁的手艺（摄影 / 书法 / 乐器）' },
  { category: 'hobby', title: '列 10 个想去的城市，挑 3 个先做攻略' },
  { category: 'relation', title: '和老朋友约定每月一次的固定聚会' },
  { category: 'relation', title: '和家人聊一次退休后想怎么过' },
]

export function createSeedItems(): PlanItem[] {
  const now = Date.now()
  return SEED.map((s, index) => ({
    id: uid(),
    category: s.category,
    title: s.title,
    done: false,
    order: index,
    createdAt: now,
    updatedAt: now,
  }))
}

const DEFAULT_STATE: LifePlansState = {
  items: createSeedItems(),
  schemaVersion: 1,
}

export const useLifePlans = defineStore('lifePlans', {
  state: (): LifePlansState => ({
    items: createSeedItems(),
    schemaVersion: 1,
  }),

  getters: {
    byCategory: (state) => {
      return (category: PlanCategory): PlanItem[] =>
        state.items
          .filter((i) => i.category === category)
          .sort((a, b) => a.order - b.order)
    },
    doneCount: (state) => state.items.filter((i) => i.done).length,
    totalCount: (state) => state.items.length,
    completionRate: (state) =>
      state.items.length === 0
        ? 0
        : state.items.filter((i) => i.done).length / state.items.length,
  },

  actions: {
    addPlan(category: PlanCategory, title: string) {
      const clean = title.trim()
      if (!clean) return
      const now = Date.now()
      const maxOrder = this.items
        .filter((i) => i.category === category)
        .reduce((max, i) => Math.max(max, i.order), -1)
      this.items.push({
        id: uid(),
        category,
        title: clean.slice(0, 120),
        done: false,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      })
    },

    togglePlan(id: string) {
      const item = this.items.find((i) => i.id === id)
      if (!item) return
      item.done = !item.done
      item.updatedAt = Date.now()
    },

    renamePlan(id: string, title: string) {
      const item = this.items.find((i) => i.id === id)
      const clean = title.trim()
      if (!item || !clean) return
      item.title = clean.slice(0, 120)
      item.updatedAt = Date.now()
    },

    removePlan(id: string): PlanItem | null {
      const index = this.items.findIndex((i) => i.id === id)
      if (index < 0) return null
      const [removed] = this.items.splice(index, 1)
      return removed ?? null
    },

    restorePlan(item: PlanItem) {
      if (this.items.some((i) => i.id === item.id)) return
      this.items.push({ ...item, updatedAt: Date.now() })
    },

    /** 原生拖拽排序：把 id 移动到 targetId 之前（或末尾） */
    movePlan(id: string, targetId: string | null, category: PlanCategory) {
      const fromIndex = this.items.findIndex((i) => i.id === id)
      if (fromIndex < 0) return
      const [item] = this.items.splice(fromIndex, 1)
      if (!item) return
      item.category = category

      const siblings = this.items
        .filter((i) => i.category === category)
        .sort((a, b) => a.order - b.order)

      let insertAt = siblings.length
      if (targetId) {
        const idx = siblings.findIndex((i) => i.id === targetId)
        if (idx >= 0) insertAt = idx
      }

      const before = insertAt > 0 ? siblings[insertAt - 1] : undefined
      const after = siblings[insertAt]
      item.order =
        before && after
          ? (before.order + after.order) / 2
          : before
            ? before.order + 1
            : after
              ? after.order - 1
              : 0
      item.updatedAt = Date.now()
      this.items.push(item)
      this.normalizeOrder(category)
    },

    /** 无拖拽环境（触屏）下的上移 / 下移 */
    shiftPlan(id: string, delta: number) {
      const item = this.items.find((i) => i.id === id)
      if (!item) return
      const siblings = this.items
        .filter((i) => i.category === item.category)
        .sort((a, b) => a.order - b.order)
      const index = siblings.findIndex((i) => i.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= siblings.length) return
      const [moved] = siblings.splice(index, 1)
      if (!moved) return
      siblings.splice(target, 0, moved)
      siblings.forEach((plan, order) => {
        plan.order = order
        plan.updatedAt = Date.now()
      })
    },

    normalizeOrder(category: PlanCategory) {
      this.items
        .filter((i) => i.category === category)
        .sort((a, b) => a.order - b.order)
        .forEach((item, index) => {
          item.order = index
        })
    },

    applyPlans(plans: LifePlansState) {
      const merged = deepMerge(DEFAULT_STATE, plans)
      this.items = Array.isArray(merged.items) ? merged.items : []
      this.schemaVersion = 1
    },

    /** 合并导入：按 id 去重，同 id 取 updatedAt 较新者 */
    mergePlans(plans: LifePlansState) {
      const incoming = Array.isArray(plans.items) ? plans.items : []
      const map = new Map(this.items.map((i) => [i.id, i]))
      for (const item of incoming) {
        const existing = map.get(item.id)
        if (!existing) {
          map.set(item.id, item)
        } else if (item.updatedAt > existing.updatedAt) {
          map.set(item.id, item)
        }
      }
      this.items = Array.from(map.values())
      const categories: PlanCategory[] = ['finance', 'health', 'hobby', 'relation']
      categories.forEach((c) => this.normalizeOrder(c))
    },

    reset() {
      this.items = createSeedItems()
      this.schemaVersion = 1
    },
  },

  persist: {
    key: `${PERSIST_PREFIX}plans`,
    storage: localStore,
    serializer: makeSerializer(DEFAULT_STATE),
  },
})
