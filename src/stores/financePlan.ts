import { defineStore } from 'pinia'
import type { FinanceState } from '@/types'
import { deepMerge, localStore, makeSerializer, PERSIST_PREFIX } from './index'

export const DEFAULT_FINANCE: FinanceState = {
  monthlySalary: 2_500_000, // ¥25,000
  yearsContributed: 8,
  monthlyTargetExpense: 1_200_000, // ¥12,000
  inflationRate: 0.03,
  investmentReturn: 0.05,
  personalAccountBalance: 0,
  schemaVersion: 1,
}

export const useFinancePlan = defineStore('financePlan', {
  state: (): FinanceState => ({ ...DEFAULT_FINANCE }),

  getters: {
    /** 每月缴费进入个人账户的金额（分） */
    monthlyAccountContribution: (state) => Math.round(state.monthlySalary * 0.08),
    savingsRate: (state) =>
      state.monthlySalary > 0
        ? Math.max(0, (state.monthlySalary - state.monthlyTargetExpense) / state.monthlySalary)
        : 0,
  },

  actions: {
    applyFinance(finance: FinanceState) {
      Object.assign(this, deepMerge(DEFAULT_FINANCE, finance))
    },
    reset() {
      Object.assign(this, { ...DEFAULT_FINANCE })
    },
  },

  persist: {
    key: `${PERSIST_PREFIX}finance`,
    storage: localStore,
    serializer: makeSerializer(DEFAULT_FINANCE),
  },
})
