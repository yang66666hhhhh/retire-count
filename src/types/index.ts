export type Gender = 'male' | 'female'

export type PlanCategory = 'finance' | 'health' | 'hobby' | 'relation'

/**
 * 所有金额字段统一为「整数、单位为分」。
 * 仅在展示时转成元，避免浮点误差。
 */
export interface ProfileState {
  /** 'YYYY-MM-01'，只精确到年月 */
  birthDate: string
  gender: Gender
  retireAge: number
  city: string
  onboarded: boolean
  /** 跳过引导后为 true，页面顶部会提示「当前是演示数据」 */
  isDemo: boolean
  schemaVersion: number
}

export interface FinanceState {
  /** 分 */
  monthlySalary: number
  yearsContributed: number
  /** 分，今日币值 */
  monthlyTargetExpense: number
  inflationRate: number
  investmentReturn: number
  /** 分，0 表示按工资自动估算 */
  personalAccountBalance: number
  schemaVersion: number
}

export interface PlanItem {
  id: string
  category: PlanCategory
  title: string
  done: boolean
  order: number
  createdAt: number
  updatedAt: number
}

export interface LifePlansState {
  items: PlanItem[]
  schemaVersion: number
}

export interface BackupFile {
  app: 'RetireCount'
  schemaVersion: number
  exportedAt: string
  data: {
    profile: ProfileState
    finance: FinanceState
    plans: LifePlansState
  }
}

export type ImportMode = 'overwrite' | 'merge'

export interface ProjectionPoint {
  age: number
  /** 分/年，今日购买力 */
  pensionIncome: number
  /** 分/年，今日购买力 */
  targetExpense: number
  /** 分/年，今日购买力 */
  gap: number
  /** 分，累计 */
  cumulativeGap: number
}

export interface MathInput {
  birthDate: string
  retireAge: number
  /** 分 */
  monthlySalary: number
  yearsContributed: number
  /** 分 */
  monthlyTargetExpense: number
  inflationRate: number
  investmentReturn: number
  /** 分 */
  personalAccountBalance: number
  /** 分 */
  cityAvgSalary: number
  now?: Date
}

export interface MathResult {
  retireDate: Date
  daysUntilRetirement: number
  monthsUntilRetirement: number
  yearsUntilRetirement: number
  totalContributionYears: number
  contributionIndex: number
  /** 分/月 */
  basicPension: number
  /** 分/月 */
  accountPension: number
  /** 分/月 */
  estimatedMonthlyPension: number
  /** 分/月，>= 0 */
  monthlyGap: number
  /** 分，退休时点 30 年缺口现值 */
  totalGapAtRetirement: number
  /** 分/月 */
  monthlyNeedToSave: number
  /** 退休后月支出占养老金的比（缺口率） */
  gapRatio: number
  realReturn: number
  projectionSeries: ProjectionPoint[]
  isRetired: boolean
  currentAge: number
}
