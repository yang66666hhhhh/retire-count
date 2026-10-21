const yuanFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
})

const yuanDecimalFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** 分 → ¥12,345 */
export function formatCents(cents: number): string {
  return `¥${yuanFormatter.format(Math.round(cents / 100))}`
}

/** 分 → ¥12,345（不带符号，用于输入框回填） */
export function centsToYuanText(cents: number): string {
  return yuanFormatter.format(Math.round(cents / 100))
}

/** 分 → 1.2 万 / 12.3 万（图表轴用） */
export function formatCentsWan(cents: number): string {
  const yuan = cents / 100
  if (Math.abs(yuan) >= 10000) {
    return `${yuanDecimalFormatter.format(yuan / 10000)}万`
  }
  return yuanFormatter.format(yuan)
}

/** 元 → 分，非法输入返回 0 */
export function yuanToCents(yuan: number | string): number {
  const n = typeof yuan === 'string' ? Number(yuan.replace(/[,¥\s]/g, '')) : yuan
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function formatDays(days: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.round(days)))
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatDateCN(date: Date): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

/** 安全解析 'YYYY-MM-01'，非法返回 null */
export function parseMonthDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(date.getTime()) ? null : date
}
