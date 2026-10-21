/**
 * 城市社平工资参考表（元/月）。
 *
 * 数据口径：城镇非私营单位在岗职工月平均工资，2023 年度公开数据整理，
 * 部分城市为省内口径估算值，仅用于本工具的「同城相对水平」测算。
 * 不构成任何官方口径，也不代表你的实际缴费基数。
 */
export interface City {
  code: string
  name: string
  /** 元/月 */
  avgSalary: number
}

export const CITIES: City[] = [
  { code: 'beijing', name: '北京', avgSalary: 11761 },
  { code: 'shanghai', name: '上海', avgSalary: 12183 },
  { code: 'shenzhen', name: '深圳', avgSalary: 13730 },
  { code: 'guangzhou', name: '广州', avgSalary: 11476 },
  { code: 'hangzhou', name: '杭州', avgSalary: 10581 },
  { code: 'nanjing', name: '南京', avgSalary: 10160 },
  { code: 'suzhou', name: '苏州', avgSalary: 9800 },
  { code: 'ningbo', name: '宁波', avgSalary: 9700 },
  { code: 'xiamen', name: '厦门', avgSalary: 9400 },
  { code: 'wuxi', name: '无锡', avgSalary: 9300 },
  { code: 'tianjin', name: '天津', avgSalary: 8970 },
  { code: 'dongguan', name: '东莞', avgSalary: 8800 },
  { code: 'foshan', name: '佛山', avgSalary: 8700 },
  { code: 'chengdu', name: '成都', avgSalary: 8770 },
  { code: 'wuhan', name: '武汉', avgSalary: 8670 },
  { code: 'hefei', name: '合肥', avgSalary: 8300 },
  { code: 'changsha', name: '长沙', avgSalary: 8200 },
  { code: 'xian', name: '西安', avgSalary: 8170 },
  { code: 'jinan', name: '济南', avgSalary: 8100 },
  { code: 'fuzhou', name: '福州', avgSalary: 8100 },
  { code: 'chongqing', name: '重庆', avgSalary: 8070 },
  { code: 'qingdao', name: '青岛', avgSalary: 7900 },
  { code: 'dalian', name: '大连', avgSalary: 7800 },
  { code: 'kunming', name: '昆明', avgSalary: 7700 },
  { code: 'nanning', name: '南宁', avgSalary: 7600 },
  { code: 'haikou', name: '海口', avgSalary: 7600 },
  { code: 'shenyang', name: '沈阳', avgSalary: 7500 },
  { code: 'nanchang', name: '南昌', avgSalary: 7500 },
  { code: 'guiyang', name: '贵阳', avgSalary: 7400 },
  { code: 'shijiazhuang', name: '石家庄', avgSalary: 7300 },
  { code: 'hohhot', name: '呼和浩特', avgSalary: 7300 },
  { code: 'taiyuan', name: '太原', avgSalary: 7200 },
  { code: 'changchun', name: '长春', avgSalary: 7100 },
  { code: 'harbin', name: '哈尔滨', avgSalary: 7200 },
  { code: 'lanzhou', name: '兰州', avgSalary: 7000 },
  { code: 'yinchuan', name: '银川', avgSalary: 7000 },
  { code: 'xining', name: '西宁', avgSalary: 7100 },
  { code: 'urumqi', name: '乌鲁木齐', avgSalary: 7800 },
]

export const DEFAULT_CITY = 'shanghai'

export function getCity(code: string): City {
  return CITIES.find((c) => c.code === code) ?? CITIES.find((c) => c.code === DEFAULT_CITY)!
}

/**
 * 个人账户养老金「计发月数」表（国家统一口径）。
 * 非表内年龄按线性插值。
 */
const PAYOUT_MONTHS: Array<[age: number, months: number]> = [
  [40, 233],
  [45, 216],
  [50, 195],
  [55, 170],
  [60, 139],
  [65, 101],
  [70, 56],
  [75, 40],
  [80, 30],
]

export function payoutMonths(age: number): number {
  if (age <= PAYOUT_MONTHS[0][0]) return PAYOUT_MONTHS[0][1]
  const last = PAYOUT_MONTHS[PAYOUT_MONTHS.length - 1]
  if (age >= last[0]) return last[1]

  for (let i = 0; i < PAYOUT_MONTHS.length - 1; i++) {
    const [a0, m0] = PAYOUT_MONTHS[i]
    const [a1, m1] = PAYOUT_MONTHS[i + 1]
    if (age >= a0 && age <= a1) {
      const t = (age - a0) / (a1 - a0)
      return Math.round(m0 + (m1 - m0) * t)
    }
  }
  return last[1]
}

/** 退休后支出「微笑曲线」：活跃期高、衰退期降、护理期再升 */
export const EXPENSE_CURVE: Array<[age: number, multiplier: number]> = [
  [60, 1.0],
  [70, 1.06],
  [78, 0.92],
  [85, 1.05],
  [90, 1.3],
]

export function expenseMultiplier(age: number): number {
  const first = EXPENSE_CURVE[0]
  const last = EXPENSE_CURVE[EXPENSE_CURVE.length - 1]
  if (age <= first[0]) return first[1]
  if (age >= last[0]) return last[1]
  for (let i = 0; i < EXPENSE_CURVE.length - 1; i++) {
    const [a0, m0] = EXPENSE_CURVE[i]
    const [a1, m1] = EXPENSE_CURVE[i + 1]
    if (age >= a0 && age <= a1) {
      const t = (age - a0) / (a1 - a0)
      return m0 + (m1 - m0) * t
    }
  }
  return 1
}
