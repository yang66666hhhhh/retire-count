import { describe, expect, it } from 'vitest'
import type { FinanceState, LifePlansState, PlanItem, ProfileState } from '@/types'
import {
  SCHEMA_VERSION,
  backupFileName,
  buildBackup,
  parseBackup,
  summarizeBackup,
} from './exportData'

const PROFILE: ProfileState = {
  birthDate: '1990-01-01',
  gender: 'male',
  retireAge: 60,
  city: 'beijing',
  onboarded: true,
  isDemo: false,
  schemaVersion: 1,
}

const FINANCE: FinanceState = {
  monthlySalary: 3_000_000,
  yearsContributed: 10,
  monthlyTargetExpense: 1_000_000,
  inflationRate: 0.03,
  investmentReturn: 0.05,
  personalAccountBalance: 0,
  schemaVersion: 1,
}

function plan(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'p1',
    category: 'finance',
    title: '还清房贷',
    done: false,
    order: 0,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

const PLANS: LifePlansState = {
  items: [plan(), plan({ id: 'p2', category: 'health', title: '每周游泳', order: 1 })],
  schemaVersion: 1,
}

function backupOf(
  profile: unknown = PROFILE,
  finance: unknown = FINANCE,
  plans: unknown = PLANS,
): string {
  return JSON.stringify({
    app: 'RetireCount',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-10-21T09:00:00.000Z',
    data: { profile, finance, plans },
  })
}

function parseOk(text: string) {
  const parsed = parseBackup(text)
  if (!parsed.ok) throw new Error(`期望解析成功，实际失败：${parsed.error}`)
  return parsed
}

describe('buildBackup', () => {
  it('生成带版本号与导出时间的完整结构', () => {
    const file = buildBackup(PROFILE, FINANCE, PLANS)
    expect(file.app).toBe('RetireCount')
    expect(file.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Number.isNaN(new Date(file.exportedAt).getTime())).toBe(false)
    expect(file.data.profile.city).toBe('beijing')
    expect(file.data.plans.items).toHaveLength(2)
  })

  it('是深拷贝：导出后修改原对象不会污染备份', () => {
    const items = [plan()]
    const file = buildBackup(PROFILE, FINANCE, { items, schemaVersion: 1 })
    items[0]!.title = '改掉了'
    expect(file.data.plans.items[0]!.title).toBe('还清房贷')
  })

  it('文件名带 8 位日期', () => {
    expect(backupFileName(new Date(2026, 9, 21))).toBe('retire-count-backup-20261021.json')
  })
})

describe('parseBackup · 合法文件', () => {
  it('可以往返解析，字段保持不变', () => {
    const file = buildBackup(PROFILE, FINANCE, PLANS)
    const parsed = parseOk(JSON.stringify(file))
    expect(parsed.issues).toEqual([])
    expect(parsed.file.data.profile).toEqual(PROFILE)
    expect(parsed.file.data.finance).toEqual(FINANCE)
    expect(parsed.file.data.plans.items).toHaveLength(2)
  })
})

describe('parseBackup · 拒绝非法文件', () => {
  it('不是 JSON', () => {
    const parsed = parseBackup('{ 这不是 json')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('JSON')
  })

  it('不是本应用的文件', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'Other', schemaVersion: 1, data: {} }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('RetireCount')
  })

  it('版本号缺失或非法', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'RetireCount', data: {} }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('版本号')
  })

  it('来自更高版本时明确拒绝', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'RetireCount', schemaVersion: 99, data: {} }),
    )
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('更新版本')
  })

  it('缺少 data 字段', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'RetireCount', schemaVersion: 1 }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('data')
  })
})

describe('parseBackup · 宽松修复', () => {
  it('越界字段被夹取，并记录问题', () => {
    const parsed = parseOk(
      backupOf({
        ...PROFILE,
        retireAge: 200,
        city: 'atlantis',
        birthDate: '1994-13-01',
        gender: 'unknown',
      }),
    )
    expect(parsed.file.data.profile.retireAge).toBe(70)
    expect(parsed.file.data.profile.city).toBe('shanghai')
    expect(parsed.file.data.profile.birthDate).toBe('1994-06-01')
    expect(parsed.file.data.profile.gender).toBe('female')
    expect(parsed.issues.length).toBeGreaterThanOrEqual(3)
  })

  it('利率越界被夹取', () => {
    const parsed = parseOk(
      backupOf(PROFILE, { ...FINANCE, inflationRate: 5, investmentReturn: 99 }),
    )
    expect(parsed.file.data.finance.inflationRate).toBe(0.2)
    expect(parsed.file.data.finance.investmentReturn).toBe(0.25)
  })

  it('缺失的字段回落到默认值', () => {
    const parsed = parseOk(backupOf({}, {}, {}))
    expect(parsed.file.data.profile.onboarded).toBe(true)
    expect(parsed.file.data.plans.items).toEqual([])
    expect(parsed.issues.length).toBeGreaterThan(0)
  })

  it('无效分类与非字符串标题的计划被丢弃', () => {
    const parsed = parseOk(
      backupOf(PROFILE, FINANCE, {
        items: [
          plan({ id: 'ok' }),
          plan({ id: 'bad-cat', category: 'travel' as never }),
          plan({ id: 'empty-title', title: '   ' }),
        ],
        schemaVersion: 1,
      }),
    )
    expect(parsed.file.data.plans.items).toHaveLength(1)
    expect(parsed.file.data.plans.items[0]!.id).toBe('ok')
  })

  it('重复 id 会被重新分配，标题被裁剪、done 被归一', () => {
    const parsed = parseOk(
      backupOf(PROFILE, FINANCE, {
        items: [
          plan({ id: 'dup', title: `  ${'长'.repeat(200)}  `, done: 1 as never }),
          plan({ id: 'dup', title: '第二条', done: true }),
        ],
        schemaVersion: 1,
      }),
    )
    const items = parsed.file.data.plans.items
    expect(items).toHaveLength(2)
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
    expect(items[0]!.title).toHaveLength(120)
    expect(items[0]!.title.startsWith(' ')).toBe(false)
    expect(items[0]!.done).toBe(false)
    expect(items[1]!.done).toBe(true)
  })

  it('计划超过 500 条时截断并提示', () => {
    const items = Array.from({ length: 501 }, (_, i) =>
      plan({ id: `bulk-${i}`, order: i, title: `计划 ${i}` }),
    )
    const parsed = parseOk(backupOf(PROFILE, FINANCE, { items, schemaVersion: 1 }))
    expect(parsed.file.data.plans.items).toHaveLength(500)
    expect(parsed.issues.some((issue) => issue.includes('500'))).toBe(true)
  })
})

describe('summarizeBackup', () => {
  it('给出城市名、计划数与完成数', () => {
    const file = buildBackup(PROFILE, FINANCE, {
      items: [plan({ id: 'a', done: true }), plan({ id: 'b' })],
      schemaVersion: 1,
    })
    const summary = summarizeBackup(file)
    expect(summary.cityName).toBe('北京')
    expect(summary.planCount).toBe(2)
    expect(summary.doneCount).toBe(1)
    expect(summary.exportedAtText).not.toBe('未知时间')
  })
})
