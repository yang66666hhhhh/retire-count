import { defineStore } from 'pinia'
import type { ProfileState } from '@/types'
import { DEFAULT_CITY, getCity } from '@/data/cities'
import { deepMerge, localStore, makeSerializer, PERSIST_PREFIX } from './index'
import { computeRetireDate, DEFAULT_RETIRE_AGE } from '@/utils/retirementMath'

export const DEFAULT_PROFILE: ProfileState = {
  birthDate: '1994-06-01',
  gender: 'female',
  retireAge: 55,
  city: DEFAULT_CITY,
  onboarded: false,
  isDemo: false,
  schemaVersion: 1,
}

export const useUserProfile = defineStore('userProfile', {
  state: (): ProfileState => ({ ...DEFAULT_PROFILE }),

  getters: {
    cityInfo: (state) => getCity(state.city),
    cityAvgSalaryCents: (state) => getCity(state.city).avgSalary * 100,
    retireDate(state): Date {
      return computeRetireDate(state.birthDate, state.retireAge)
    },
    retireAgeLabel(state): string {
      return `${state.retireAge} 岁`
    },
  },

  actions: {
    completeOnboarding(payload: Partial<ProfileState>) {
      Object.assign(this, payload)
      this.onboarded = true
    },
    setRetireAge(age: number) {
      this.retireAge = Math.min(70, Math.max(45, Math.round(age)))
    },
    /** 切换性别时，如果退休年龄还停留在默认值，就跟着换 */
    setGender(gender: ProfileState['gender']) {
      const wasDefault =
        this.retireAge === DEFAULT_RETIRE_AGE.male || this.retireAge === DEFAULT_RETIRE_AGE.female
      this.gender = gender
      if (wasDefault) this.retireAge = DEFAULT_RETIRE_AGE[gender]
    },
    setCity(code: string) {
      this.city = getCity(code).code
    },
    applyProfile(profile: ProfileState) {
      Object.assign(this, deepMerge(DEFAULT_PROFILE, profile))
    },
    reset() {
      Object.assign(this, { ...DEFAULT_PROFILE })
    },
  },

  persist: {
    key: `${PERSIST_PREFIX}profile`,
    storage: localStore,
    serializer: makeSerializer(DEFAULT_PROFILE),
  },
})
