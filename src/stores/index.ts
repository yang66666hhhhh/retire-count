import { createPinia, type StateTree } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

/**
 * 本地持久化层。
 *
 * 设计要点：
 * 1. 每个 store 一个独立 key，避免互相覆盖（共用同一个 key 是常见 bug）。
 * 2. 写入防抖 300ms；pagehide / 页面隐藏时强制 flush，防止关标签页丢数据。
 * 3. 读取时先看 pending 队列，再看 localStorage，保证同一 tick 内「写完立刻读」拿到新值。
 */

export const PERSIST_PREFIX = 'retire-count-v1:'

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem?: (key: string) => void
}

const MAX_PENDING_MS = 300

export function createDebouncedStorage(delay = MAX_PENDING_MS) {
  const pending = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const hasWindow = typeof window !== 'undefined'

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!hasWindow || pending.size === 0) return
    try {
      pending.forEach((value, key) => window.localStorage.setItem(key, value))
    } catch {
      // 隐私模式 / 配额满：静默失败，不影响使用
    }
    pending.clear()
  }

  const storage: StorageLike & { flush: () => void; clearAll: () => void } = {
    getItem(key) {
      if (pending.has(key)) return pending.get(key) ?? null
      if (!hasWindow) return null
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key, value) {
      if (!hasWindow) return
      pending.set(key, value)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    removeItem(key) {
      pending.delete(key)
      if (!hasWindow) return
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* noop */
      }
    },
    flush,
    clearAll() {
      pending.clear()
      if (!hasWindow) return
      try {
        const keys: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && key.startsWith(PERSIST_PREFIX)) keys.push(key)
        }
        keys.forEach((k) => window.localStorage.removeItem(k))
      } catch {
        /* noop */
      }
    },
  }

  if (hasWindow) {
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return storage
}

export const localStore = createDebouncedStorage()

export function flushPersist(): void {
  localStore.flush()
}

export function clearAllPersisted(): void {
  localStore.clearAll()
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/** 用已持久化的值覆盖默认值；数组直接替换，对象递归合并（保证新增字段有默认值） */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T)) ?? base
  }
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = result[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value)
    } else {
      result[key] = value
    }
  }
  return result as T
}

/**
 * 给每个 store 生成带「默认值兜底」的序列化器。
 * v4 的 `merge` 选项已被移除，这里用 serializer.deserialize 实现同样的语义：
 * 旧备份缺少新增字段时，自动补上默认值，而不是变成 undefined。
 */
export function makeSerializer<T extends StateTree>(defaults: T) {
  return {
    serialize: (data: StateTree) => JSON.stringify(data),
    deserialize: (data: string): StateTree => {
      try {
        const parsed: unknown = JSON.parse(data)
        return deepMerge(defaults, parsed) as unknown as StateTree
      } catch {
        return defaults as unknown as StateTree
      }
    },
  }
}

export const pinia = createPinia()

pinia.use(
  createPersistedState({
    storage: localStore,
  }),
)
