import type {
  BackupFile,
  FinanceState,
  LifePlansState,
  PlanCategory,
  PlanItem,
  ProfileState,
} from '@/types'
import { CITIES, DEFAULT_CITY, getCity } from '@/data/cities'
import { formatDateISO } from './format'

export const SCHEMA_VERSION = 1
const APP_ID = 'RetireCount'

/* ------------------------------------------------------------------ *
 * 导出
 * ------------------------------------------------------------------ */

export function buildBackup(
  profile: ProfileState,
  finance: FinanceState,
  plans: LifePlansState,
): BackupFile {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      profile: { ...profile },
      finance: { ...finance },
      plans: { items: plans.items.map((i) => ({ ...i })), schemaVersion: plans.schemaVersion },
    },
  }
}

export function backupFileName(date = new Date()): string {
  return `retire-count-backup-${formatDateISO(date)}.json`
}

/** 纯前端下载：Blob + <a download>，不经过任何网络请求 */
export function downloadBackup(file: BackupFile): string {
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const name = backupFileName()
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}

/* ------------------------------------------------------------------ *
 * 导入校验（手写，不引 zod；宽松修复 + 结构错误才拒绝）
 * ------------------------------------------------------------------ */

export type ParseResult =
  | { ok: true; file: BackupFile; issues: string[] }
  | { ok: false; error: string }

const CATEGORY_SET = new Set<string>(['finance', 'health', 'hobby', 'relation'])
const CITY_SET = new Set(CITIES.map((c) => c.code))
const MAX_PLANS = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(
  value: unknown,
  fallback: number,
  issues: string[],
  label: string,
  min?: number,
  max?: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(`${label} 缺失，已使用默认值`)
    return fallback
  }
  if (min !== undefined && max !== undefined) {
    const clamped = Math.min(max, Math.max(min, value))
    if (clamped !== value) {
      issues.push(`${label} 超出范围（${value}），已修正为 ${clamped}`)
    }
    return clamped
  }
  return value
}

function sanitizeProfile(raw: unknown, issues: string[]): ProfileState {
  const src = isRecord(raw) ? raw : {}
  if (!isRecord(raw)) issues.push('档案数据缺失，已使用默认值')

  const birthRaw = typeof src.birthDate === 'string' ? src.birthDate : ''
  const birthValid = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthRaw)
  if (!birthValid && birthRaw) issues.push('出生年月格式异常，已回退为默认值')

  const cityRaw = typeof src.city === 'string' ? src.city : ''
  if (cityRaw && !CITY_SET.has(cityRaw)) issues.push('城市不在支持列表内，已回退为上海')

  const genderValid = src.gender === 'male' || src.gender === 'female'
  if (!genderValid && src.gender !== undefined) issues.push('性别取值异常，已回退为女性')
  const gender: ProfileState['gender'] =
    src.gender === 'male' || src.gender === 'female' ? src.gender : 'female'

  return {
    birthDate: birthValid ? birthRaw : '1994-06-01',
    gender,
    retireAge: num(src.retireAge, 55, issues, '退休年龄', 45, 70),
    city: CITY_SET.has(cityRaw) ? cityRaw : DEFAULT_CITY,
    onboarded: typeof src.onboarded === 'boolean' ? src.onboarded : true,
    schemaVersion: SCHEMA_VERSION,
  }
}

function sanitizeFinance(raw: unknown, issues: string[]): FinanceState {
  const src = isRecord(raw) ? raw : {}
  if (!isRecord(raw)) issues.push('测算数据缺失，已使用默认值')

  return {
    monthlySalary: num(src.monthlySalary, 2_500_000, issues, '月薪', 0, 1e12),
    yearsContributed: num(src.yearsContributed, 8, issues, '已缴年限', 0, 40),
    monthlyTargetExpense: num(
      src.monthlyTargetExpense,
      1_200_000,
      issues,
      '目标月支出',
      0,
      1e12,
    ),
    inflationRate: num(src.inflationRate, 0.03, issues, '通胀率', -0.05, 0.2),
    investmentReturn: num(src.investmentReturn, 0.05, issues, '投资回报率', -0.05, 0.25),
    personalAccountBalance: num(
      src.personalAccountBalance,
      0,
      issues,
      '个人账户余额',
      0,
      1e12,
    ),
    schemaVersion: SCHEMA_VERSION,
  }
}

function sanitizePlans(raw: unknown, issues: string[]): LifePlansState {
  const src = isRecord(raw) ? raw : {}
  const list = Array.isArray(src.items) ? src.items : []
  if (!Array.isArray(src.items)) issues.push('计划清单缺失，已作为空清单导入')

  const now = Date.now()
  const seen = new Set<string>()
  const items: PlanItem[] = []

  for (const entry of list.slice(0, MAX_PLANS)) {
    if (!isRecord(entry)) continue
    const category = typeof entry.category === 'string' ? entry.category : ''
    if (!CATEGORY_SET.has(category)) continue

    const title = typeof entry.title === 'string' ? entry.title.trim() : ''
    if (!title) continue

    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : ''
    if (!id || seen.has(id)) id = `imported_${now}_${items.length}_${Math.random().toString(36).slice(2, 7)}`
    seen.add(id)

    items.push({
      id,
      category: category as PlanCategory,
      title: title.slice(0, 120),
      done: entry.done === true,
      order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : items.length,
      createdAt:
        typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : now,
      updatedAt:
        typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : now,
    })
  }

  if (list.length > MAX_PLANS) issues.push(`计划条数超过 ${MAX_PLANS}，已截断`)

  return { items, schemaVersion: SCHEMA_VERSION }
}

export function parseBackup(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是合法的 JSON 文件' }
  }

  if (!isRecord(parsed)) return { ok: false, error: '备份文件结构不正确' }
  if (parsed.app !== APP_ID) return { ok: false, error: '这不是 RetireCount 的备份文件' }

  const version = parsed.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: '备份版本号缺失或无效' }
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `备份来自更新版本（v${version}），请先升级本应用` }
  }

  const data = isRecord(parsed.data) ? parsed.data : null
  if (!data) return { ok: false, error: '备份文件缺少 data 字段' }

  const issues: string[] = []
  const file: BackupFile = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    data: {
      profile: sanitizeProfile(data.profile, issues),
      finance: sanitizeFinance(data.finance, issues),
      plans: sanitizePlans(data.plans, issues),
    },
  }

  return { ok: true, file, issues }
}

export interface BackupSummary {
  cityName: string
  planCount: number
  doneCount: number
  exportedAtText: string
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const date = new Date(file.exportedAt)
  return {
    cityName: getCity(file.data.profile.city).name,
    planCount: file.data.plans.items.length,
    doneCount: file.data.plans.items.filter((i) => i.done).length,
    exportedAtText: Number.isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN'),
  }
}
