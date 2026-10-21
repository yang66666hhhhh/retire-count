import type { PlanCategory } from '@/types'

export interface PlanCategoryMeta {
  key: PlanCategory
  label: string
  en: string
  hint: string
  placeholder: string
  /** 文字色 */
  text: string
  /** 边框 / 背景 / 装饰色 */
  border: string
  bg: string
  dot: string
  bar: string
  placeholderTone: string
}

export const PLAN_CATEGORIES: PlanCategoryMeta[] = [
  {
    key: 'finance',
    label: '财务',
    en: 'Money',
    hint: '让钱在你不上班以后继续上班',
    placeholder: '例如：把房贷还到只剩余额…',
    text: 'text-emerald-300',
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-400/[0.06]',
    dot: 'bg-emerald-400',
    bar: 'from-emerald-400 to-emerald-500',
    placeholderTone: 'placeholder:text-emerald-200/25',
  },
  {
    key: 'health',
    label: '健康',
    en: 'Health',
    hint: '退休生活的本金，不是利息',
    placeholder: '例如：每周游泳两次…',
    text: 'text-sky-300',
    border: 'border-sky-400/20',
    bg: 'bg-sky-400/[0.06]',
    dot: 'bg-sky-400',
    bar: 'from-sky-400 to-sky-500',
    placeholderTone: 'placeholder:text-sky-200/25',
  },
  {
    key: 'hobby',
    label: '兴趣',
    en: 'Hobby',
    hint: '把「以后有空再做」变成日程',
    placeholder: '例如：学半年水彩…',
    text: 'text-violet-300',
    border: 'border-violet-400/20',
    bg: 'bg-violet-400/[0.06]',
    dot: 'bg-violet-400',
    bar: 'from-violet-400 to-violet-500',
    placeholderTone: 'placeholder:text-violet-200/25',
  },
  {
    key: 'relation',
    label: '关系',
    en: 'People',
    hint: '退休后最怕的不是没钱，是没人',
    placeholder: '例如：每月和老同学吃一次饭…',
    text: 'text-amber-300',
    border: 'border-amber-400/20',
    bg: 'bg-amber-400/[0.06]',
    dot: 'bg-amber-400',
    bar: 'from-amber-400 to-amber-500',
    placeholderTone: 'placeholder:text-amber-200/25',
  },
]

export function getCategoryMeta(key: PlanCategory): PlanCategoryMeta {
  return PLAN_CATEGORIES.find((c) => c.key === key) ?? PLAN_CATEGORIES[0]
}
