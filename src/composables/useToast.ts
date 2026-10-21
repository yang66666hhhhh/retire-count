import { ref } from 'vue'

export type ToastTone = 'default' | 'success' | 'danger'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  actionLabel?: string
  onAction?: () => void
  duration: number
}

const items = ref<ToastItem[]>([])
let seed = 0

export function dismissToast(id: number) {
  items.value = items.value.filter((t) => t.id !== id)
}

export function pushToast(
  message: string,
  options: {
    tone?: ToastTone
    actionLabel?: string
    onAction?: () => void
    duration?: number
  } = {},
): number {
  const id = ++seed
  const item: ToastItem = {
    id,
    message,
    tone: options.tone ?? 'default',
    actionLabel: options.actionLabel,
    onAction: options.onAction,
    duration: options.duration ?? (options.actionLabel ? 6000 : 3200),
  }
  items.value = [...items.value.slice(-2), item]
  window.setTimeout(() => dismissToast(id), item.duration)
  return id
}

export function useToasts() {
  return { items, pushToast, dismissToast }
}
