import { expenseMultiplier, payoutMonths } from '@/data/cities'
import type { MathInput, MathResult, ProjectionPoint } from '@/types'

/**
 * 核心测算模型 —— 纯函数，不依赖 Vue / 浏览器，可单测。
 *
 * 口径声明：
 * 1. 所有输出金额均为「今日购买力（实际值）」，输入的名义利率会先折算为实际利率。
 * 2. 金额单位统一为「分」，中间计算允许浮点，出口统一取整。
 * 3. 这是简化模型，不是社保官方口径，不构成财务建议。
 */

const MS_PER_DAY = 86_400_000
const DAYS_PER_MONTH = 30.4375
const DAYS_PER_YEAR = 365.2425

/** 个人账户实际记账利率（保守取 2%，低于近年实际记账利率） */
const ACCOUNT_REAL_RATE = 0.02
/** 个人缴费进入个人账户的比例 */
const ACCOUNT_CONTRIBUTION_RATE = 0.08
/** 缴费年限上限 */
const MAX_CONTRIBUTION_YEARS = 40
/** 退休后测算区间长度（年） */
const RETIREMENT_YEARS = 30
/** 养老金年度调整幅度落后真实通胀的比例：0.15 × 通胀 ≈ 0.45%/年 */
const PENSION_ADJUST_GAP_RATIO = 0.15

export const DEFAULT_RETIRE_AGE = { male: 60, female: 55 } as const
export const RETIRE_AGE_MIN = 45
export const RETIRE_AGE_MAX = 70

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseBirthDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return new Date(1990, 0, 1)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 出生年月 + 退休年龄 → 退休日期（当月 1 日） */
export function computeRetireDate(birthDate: string, retireAge: number): Date {
  const birth = parseBirthDate(birthDate)
  return new Date(birth.getFullYear() + retireAge, birth.getMonth(), 1)
}

/**
 * 参加工作年月：假设社保连续缴纳到「今天」，则起点 = 今天 − 已缴年限。
 * 早于 16 岁、晚于退休日的异常值会被夹住。
 */
export function computeWorkStart(
  birthDate: string,
  retireAge: number,
  yearsContributed: number,
  now: Date = new Date(),
): Date {
  const birth = parseBirthDate(birthDate)
  const byContribution = new Date(
    now.getTime() - Math.max(0, yearsContributed) * DAYS_PER_YEAR * MS_PER_DAY,
  )
  const earliest = new Date(birth.getFullYear() + 16, birth.getMonth(), 1)
  const retireDate = computeRetireDate(birthDate, retireAge)
  const latest = new Date(retireDate.getTime() - MS_PER_DAY)
  if (byContribution < earliest) return earliest
  if (byContribution > latest) return latest
  return byContribution
}

function ageInYears(birth: Date, at: Date): number {
  return (at.getTime() - birth.getTime()) / (DAYS_PER_YEAR * MS_PER_DAY)
}

export function computeRetirement(input: MathInput): MathResult {
  const now = input.now ?? new Date()
  const birth = parseBirthDate(input.birthDate)
  const retireDate = computeRetireDate(input.birthDate, input.retireAge)

  const isRetired = now.getTime() >= retireDate.getTime()
  const daysUntilRetirement = Math.max(
    0,
    Math.ceil((retireDate.getTime() - now.getTime()) / MS_PER_DAY),
  )
  const monthsUntilRetirement = daysUntilRetirement / DAYS_PER_MONTH
  const yearsUntilRetirement = daysUntilRetirement / DAYS_PER_YEAR
  const currentAge = ageInYears(birth, now)

  const cityAvg = Math.max(0, input.cityAvgSalary)
  const salary = Math.max(0, input.monthlySalary)
  // 没有工资就没有缴费：不能把「退休前的空档」也算成缴费年限
  const futureContributionYears = salary > 0 ? yearsUntilRetirement : 0

  const totalContributionYears = clamp(
    input.yearsContributed + futureContributionYears,
    0,
    MAX_CONTRIBUTION_YEARS,
  )

  // 没有任何工资收入时不存在缴费，指数按 0 处理（否则会被 0.6 的下限抬出一笔养老金）
  const contributionIndex =
    cityAvg > 0 && salary > 0 ? clamp(salary / cityAvg, 0.6, 3) : 0

  // ① 基础养老金：社平 × (1 + 缴费指数) / 2 × 缴费年限 × 1%
  const basicPension =
    cityAvg * ((1 + contributionIndex) / 2) * totalContributionYears * 0.01

  // ② 个人账户：现有余额复利 + 未来按月缴入的年金终值
  const existingBalance =
    input.personalAccountBalance > 0
      ? input.personalAccountBalance
      : salary * ACCOUNT_CONTRIBUTION_RATE * 12 * input.yearsContributed
  const annualContribution = salary * ACCOUNT_CONTRIBUTION_RATE * 12
  const growth = Math.pow(1 + ACCOUNT_REAL_RATE, yearsUntilRetirement)
  const accountAtRetirement =
    existingBalance * growth +
    annualContribution * ((growth - 1) / ACCOUNT_REAL_RATE)
  const accountPension = accountAtRetirement / payoutMonths(input.retireAge)

  const estimatedMonthlyPension = basicPension + accountPension

  // ③ 缺口与折现
  const monthlyGap = Math.max(0, input.monthlyTargetExpense - estimatedMonthlyPension)
  const realReturn =
    (1 + input.investmentReturn) / (1 + input.inflationRate) - 1
  const monthlyRealReturn = Math.pow(1 + realReturn, 1 / 12) - 1

  const periods = RETIREMENT_YEARS * 12
  let totalGapAtRetirement = 0
  if (monthlyGap > 0) {
    totalGapAtRetirement =
      Math.abs(monthlyRealReturn) < 1e-9
        ? monthlyGap * periods
        : (monthlyGap * (1 - Math.pow(1 + monthlyRealReturn, -periods))) /
          monthlyRealReturn
    // 期初年金（退休当月就要花）
    totalGapAtRetirement *= 1 + monthlyRealReturn
  }

  // ④ 每月需额外储蓄：把退休时点的缺口现值，摊回到每个月
  let monthlyNeedToSave = 0
  if (totalGapAtRetirement > 0 && monthsUntilRetirement > 0) {
    monthlyNeedToSave =
      Math.abs(monthlyRealReturn) < 1e-9
        ? totalGapAtRetirement / monthsUntilRetirement
        : (totalGapAtRetirement * monthlyRealReturn) /
          (Math.pow(1 + monthlyRealReturn, monthsUntilRetirement) - 1)
  }

  // ⑤ 退休后逐年投影（用微笑曲线 + 养老金购买力衰减，让曲线有形状）
  const projectionSeries = buildProjection({
    startAge: isRetired
      ? Math.max(Math.floor(currentAge), input.retireAge)
      : input.retireAge,
    endAge: input.retireAge + RETIREMENT_YEARS,
    retireAge: input.retireAge,
    pension: estimatedMonthlyPension,
    targetMonthly: input.monthlyTargetExpense,
    inflationRate: input.inflationRate,
  })

  return {
    retireDate,
    daysUntilRetirement,
    monthsUntilRetirement,
    yearsUntilRetirement,
    totalContributionYears,
    contributionIndex,
    basicPension: Math.round(basicPension),
    accountPension: Math.round(accountPension),
    estimatedMonthlyPension: Math.round(estimatedMonthlyPension),
    monthlyGap: Math.round(monthlyGap),
    totalGapAtRetirement: Math.round(totalGapAtRetirement),
    monthlyNeedToSave: Math.round(monthlyNeedToSave),
    gapRatio:
      input.monthlyTargetExpense > 0 ? monthlyGap / input.monthlyTargetExpense : 0,
    realReturn,
    projectionSeries,
    isRetired,
    currentAge,
  }
}

function buildProjection(args: {
  startAge: number
  endAge: number
  retireAge: number
  pension: number
  targetMonthly: number
  inflationRate: number
}): ProjectionPoint[] {
  const { startAge, endAge, retireAge, pension, targetMonthly, inflationRate } = args
  const series: ProjectionPoint[] = []
  let cumulative = 0
  const decay = Math.min(0.05, PENSION_ADJUST_GAP_RATIO * Math.max(0, inflationRate))

  for (let age = Math.round(startAge); age <= endAge; age++) {
    const pensionReal = pension * Math.pow(1 - decay, Math.max(0, age - retireAge)) * 12
    const targetExpense = targetMonthly * expenseMultiplier(age) * 12
    const gap = Math.max(0, targetExpense - pensionReal)
    cumulative += gap
    series.push({
      age,
      pensionIncome: Math.round(pensionReal),
      targetExpense: Math.round(targetExpense),
      gap: Math.round(gap),
      cumulativeGap: Math.round(cumulative),
    })
  }
  return series
}

/** 退休后第 N 年的月缺口（用于文案提示） */
export function gapAtAge(result: MathResult, age: number): number {
  const point = result.projectionSeries.find((p) => p.age === age)
  return point ? Math.round(point.gap / 12) : result.monthlyGap
}
