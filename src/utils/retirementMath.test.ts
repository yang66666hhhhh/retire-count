import { describe, expect, it } from 'vitest'
import type { MathInput } from '@/types'
import {
  DEFAULT_RETIRE_AGE,
  RETIRE_AGE_MAX,
  RETIRE_AGE_MIN,
  computeRetireDate,
  computeRetirement,
  computeWorkStart,
  gapAtAge,
} from './retirementMath'
import { expenseMultiplier, payoutMonths } from '@/data/cities'

const NOW = new Date(2026, 9, 21, 9, 0, 0) // 2026-10-21 09:00 本地时间

function baseInput(overrides: Partial<MathInput> = {}): MathInput {
  return {
    birthDate: '1994-06-01',
    retireAge: 55,
    monthlySalary: 2_500_000, // ¥25,000
    yearsContributed: 8,
    monthlyTargetExpense: 1_200_000, // ¥12,000
    inflationRate: 0.03,
    investmentReturn: 0.05,
    personalAccountBalance: 0,
    cityAvgSalary: 1_218_300, // 上海 12,183 元/月
    now: NOW,
    ...overrides,
  }
}

describe('computeRetireDate', () => {
  it('出生年月 + 退休年龄 → 当月 1 日', () => {
    const date = computeRetireDate('1994-06-01', 55)
    expect(date.getFullYear()).toBe(2049)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(1)
  })

  it('非法出生年月回退到默认值而不是崩溃', () => {
    const date = computeRetireDate('not-a-date', 60)
    expect(Number.isNaN(date.getTime())).toBe(false)
  })
})

describe('倒计时', () => {
  it('未退休时天数与 retireDate 一致', () => {
    const result = computeRetirement(baseInput())
    const expected = Math.ceil((result.retireDate.getTime() - NOW.getTime()) / 86_400_000)
    expect(result.daysUntilRetirement).toBe(expected)
    expect(result.isRetired).toBe(false)
    expect(result.monthsUntilRetirement).toBeGreaterThan(0)
  })

  it('退休当天：天数为 0、不再需要储蓄', () => {
    const retireDate = computeRetireDate('1994-06-01', 55)
    const result = computeRetirement(
      baseInput({ now: new Date(retireDate.getTime()) }),
    )
    expect(result.isRetired).toBe(true)
    expect(result.daysUntilRetirement).toBe(0)
    expect(result.monthsUntilRetirement).toBe(0)
    expect(result.monthlyNeedToSave).toBe(0)
  })

  it('已退休：天数为 0，投影从当前年龄开始', () => {
    const result = computeRetirement(
      baseInput({ now: new Date(2052, 0, 1) }),
    )
    expect(result.isRetired).toBe(true)
    expect(result.daysUntilRetirement).toBe(0)
    expect(result.monthlyNeedToSave).toBe(0)
    expect(result.projectionSeries[0]!.age).toBeGreaterThanOrEqual(55)
  })
})

describe('养老金与缺口', () => {
  it('基础养老金 + 个人账户 = 月养老金，且都为整数分', () => {
    const result = computeRetirement(baseInput())
    // 三段分别四舍五入，允许 1 分误差
    expect(
      Math.abs(result.estimatedMonthlyPension - (result.basicPension + result.accountPension)),
    ).toBeLessThanOrEqual(1)
    for (const value of [
      result.basicPension,
      result.accountPension,
      result.estimatedMonthlyPension,
      result.monthlyGap,
      result.totalGapAtRetirement,
      result.monthlyNeedToSave,
    ]) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('目标支出低于养老金时，缺口与储蓄都为 0', () => {
    const result = computeRetirement(baseInput({ monthlyTargetExpense: 10_000 }))
    expect(result.monthlyGap).toBe(0)
    expect(result.totalGapAtRetirement).toBe(0)
    expect(result.monthlyNeedToSave).toBe(0)
    expect(result.gapRatio).toBe(0)
  })

  it('实际收益率为 0 时退化为「缺口 × 360 期」', () => {
    const result = computeRetirement(
      baseInput({ inflationRate: 0.03, investmentReturn: 0.03 }),
    )
    expect(Math.abs(result.realReturn)).toBeLessThan(1e-12)
    expect(Math.abs(result.totalGapAtRetirement - result.monthlyGap * 360)).toBeLessThan(400)
  })

  it('通胀越高，缺口现值越大', () => {
    const low = computeRetirement(baseInput({ inflationRate: 0.01 }))
    const high = computeRetirement(baseInput({ inflationRate: 0.05 }))
    expect(high.totalGapAtRetirement).toBeGreaterThan(low.totalGapAtRetirement)
  })

  it('月薪越高，养老金越高', () => {
    const low = computeRetirement(baseInput({ monthlySalary: 800_000 }))
    const high = computeRetirement(baseInput({ monthlySalary: 4_000_000 }))
    expect(high.estimatedMonthlyPension).toBeGreaterThan(low.estimatedMonthlyPension)
  })
})

describe('边界与夹取', () => {
  it('缴费年限封顶 40 年', () => {
    const result = computeRetirement(baseInput({ yearsContributed: 40 }))
    expect(result.totalContributionYears).toBe(40)
  })

  it('缴费指数夹在 0.6 ~ 3.0 之间', () => {
    const rich = computeRetirement(baseInput({ monthlySalary: 100_000_000 }))
    const poor = computeRetirement(baseInput({ monthlySalary: 100 }))
    expect(rich.contributionIndex).toBe(3)
    expect(poor.contributionIndex).toBe(0.6)
  })

  it('月薪为 0 时养老金为 0，缺口等于目标支出', () => {
    const result = computeRetirement(baseInput({ monthlySalary: 0, yearsContributed: 0 }))
    expect(result.estimatedMonthlyPension).toBe(0)
    expect(result.monthlyGap).toBe(1_200_000)
  })

  it('退休年龄常量在合理区间', () => {
    expect(DEFAULT_RETIRE_AGE.male).toBe(60)
    expect(DEFAULT_RETIRE_AGE.female).toBe(55)
    expect(RETIRE_AGE_MIN).toBeLessThan(RETIRE_AGE_MAX)
  })
})

describe('投影序列', () => {
  it('从退休年龄到 +30 年，逐年连续', () => {
    const result = computeRetirement(baseInput())
    const series = result.projectionSeries
    expect(series).toHaveLength(31)
    expect(series[0]!.age).toBe(55)
    expect(series.at(-1)!.age).toBe(85)
    series.forEach((point, index) => {
      if (index > 0) expect(point.age).toBe(series[index - 1]!.age + 1)
      expect(point.gap).toBeGreaterThanOrEqual(0)
    })
  })

  it('累计缺口单调不减', () => {
    const series = computeRetirement(baseInput()).projectionSeries
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.cumulativeGap).toBeGreaterThanOrEqual(series[i - 1]!.cumulativeGap)
    }
  })

  it('养老金购买力衰减 + 护理期支出上升，让缺口逐年放大', () => {
    const series = computeRetirement(baseInput()).projectionSeries
    expect(series.at(-1)!.gap).toBeGreaterThan(series[0]!.gap)
  })

  it('gapAtAge 取到对应年份的月缺口', () => {
    const result = computeRetirement(baseInput())
    const point = result.projectionSeries[10]!
    expect(gapAtAge(result, point.age)).toBe(Math.round(point.gap / 12))
    expect(gapAtAge(result, 200)).toBe(result.monthlyGap)
  })
})

describe('工作起点', () => {
  it('默认按「今天 − 已缴年限」推算', () => {
    const start = computeWorkStart('1994-06-01', 55, 8, NOW)
    const years = (NOW.getTime() - start.getTime()) / (365.2425 * 86_400_000)
    expect(years).toBeCloseTo(8, 1)
  })

  it('年限大到早于 16 岁时，夹到 16 岁', () => {
    const start = computeWorkStart('1994-06-01', 55, 40, NOW)
    expect(start.getFullYear()).toBe(2010)
    expect(start.getMonth()).toBe(5)
  })

  it('年限为 0 时起点就是今天', () => {
    const start = computeWorkStart('1994-06-01', 55, 0, NOW)
    expect(start.getTime()).toBe(NOW.getTime())
  })
})

describe('数据表', () => {
  it('计发月数符合国家口径，并在区间内插值', () => {
    expect(payoutMonths(50)).toBe(195)
    expect(payoutMonths(55)).toBe(170)
    expect(payoutMonths(60)).toBe(139)
    expect(payoutMonths(65)).toBe(101)
    expect(payoutMonths(57.5)).toBe(155)
    expect(payoutMonths(30)).toBe(233)
    expect(payoutMonths(99)).toBe(30)
  })

  it('支出微笑曲线端点与拐点', () => {
    expect(expenseMultiplier(60)).toBe(1)
    expect(expenseMultiplier(78)).toBeCloseTo(0.92, 5)
    expect(expenseMultiplier(90)).toBeCloseTo(1.3, 5)
    expect(expenseMultiplier(40)).toBe(1)
    expect(expenseMultiplier(120)).toBeCloseTo(1.3, 5)
  })
})
