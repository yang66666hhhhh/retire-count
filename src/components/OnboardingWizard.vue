<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles } from 'lucide-vue-next'
import AppDialog from './ui/AppDialog.vue'
import NumberField from './ui/NumberField.vue'
import { CITIES, getCity } from '@/data/cities'
import { useUserProfile } from '@/stores/userProfile'
import { useFinancePlan } from '@/stores/financePlan'
import { DEFAULT_RETIRE_AGE } from '@/utils/retirementMath'
import { pushToast } from '@/composables/useToast'
import type { Gender } from '@/types'
import { cn } from '@/utils/cn'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'done'): void
}>()

const profile = useUserProfile()
const finance = useFinancePlan()

const step = ref(0)
const error = ref('')

const form = ref({
  birthMonth: '1994-06',
  gender: 'female' as Gender,
  retireAge: 55,
  city: 'shanghai',
  monthlySalary: 2_500_000,
  yearsContributed: 8,
  monthlyTargetExpense: 1_200_000,
})

const steps = ['关于你', '退休节点', '钱的事']

watch(
  () => props.open,
  (open) => {
    if (!open) return
    step.value = 0
    error.value = ''
    form.value = {
      birthMonth: profile.birthDate.slice(0, 7),
      gender: profile.gender,
      retireAge: profile.retireAge,
      city: profile.city,
      monthlySalary: finance.monthlySalary,
      yearsContributed: finance.yearsContributed,
      monthlyTargetExpense: finance.monthlyTargetExpense,
    }
  },
)

const cityInfo = computed(() => getCity(form.value.city))
const currentYear = new Date().getFullYear()

function pickGender(gender: Gender) {
  form.value.gender = gender
  const isDefault =
    form.value.retireAge === DEFAULT_RETIRE_AGE.male ||
    form.value.retireAge === DEFAULT_RETIRE_AGE.female
  if (isDefault) form.value.retireAge = DEFAULT_RETIRE_AGE[gender]
}

function validate(): boolean {
  error.value = ''
  if (step.value === 0) {
    const year = Number(form.value.birthMonth.slice(0, 4))
    if (!/^\d{4}-\d{2}$/.test(form.value.birthMonth)) {
      error.value = '请选择出生年月'
      return false
    }
    if (year < 1940 || year > currentYear - 16) {
      error.value = '出生年份看起来不太对，请检查'
      return false
    }
  }
  if (step.value === 1) {
    if (form.value.retireAge < 45 || form.value.retireAge > 70) {
      error.value = '退休年龄请填 45–70 岁之间'
      return false
    }
  }
  return true
}

function next() {
  if (!validate()) return
  if (step.value < 2) {
    step.value += 1
    return
  }
  finish()
}

function finish() {
  profile.completeOnboarding({
    birthDate: `${form.value.birthMonth}-01`,
    gender: form.value.gender,
    retireAge: form.value.retireAge,
    city: form.value.city,
    isDemo: false,
  })
  finance.monthlySalary = form.value.monthlySalary
  finance.yearsContributed = form.value.yearsContributed
  finance.monthlyTargetExpense = form.value.monthlyTargetExpense
  emit('update:open', false)
  emit('done')
  pushToast('档案已保存到本机，随时可以修改', { tone: 'success' })
}

function skip() {
  profile.completeOnboarding({ isDemo: true })
  emit('update:open', false)
  emit('done')
  pushToast('已载入演示数据 · 页面顶部可一键改成你自己的信息')
}
</script>

<template>
  <AppDialog
    :open="props.open"
    title="先花 30 秒，把倒计时对准你"
    description="三步填完。所有金额都会换算成「今天的购买力」，不用自己算通胀。数据只存在这台设备上。"
    size="md"
    :hide-close="true"
    @update:open="emit('update:open', $event)"
  >
    <div class="mb-5 flex items-center gap-2">
      <div
        v-for="(label, index) in steps"
        :key="label"
        class="flex items-center gap-2"
        :class="index < steps.length - 1 && 'flex-1'"
      >
        <div class="flex items-center gap-1.5">
          <span
            :class="
              cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                index < step
                  ? 'bg-emerald-500 text-ink-950'
                  : index === step
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50'
                    : 'bg-white/5 text-slate-500',
              )
            "
          >
            <Check v-if="index < step" class="h-3 w-3" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span
            :class="
              cn(
                'text-[12px]',
                index === step ? 'text-slate-200' : 'text-slate-500',
              )
            "
          >
            {{ label }}
          </span>
        </div>
        <div v-if="index < steps.length - 1" class="h-px flex-1 bg-white/10" />
      </div>
    </div>

    <div v-if="step === 0" class="space-y-4">
      <div>
        <label class="label" for="ob-birth">出生年月</label>
        <input
          id="ob-birth"
          v-model="form.birthMonth"
          type="month"
          :max="`${currentYear - 16}-12`"
          min="1940-01"
          class="input font-mono"
        />
        <p class="mt-1.5 text-[11px] text-slate-500">只用来算还有多少天到退休日，精确到月份就够。</p>
      </div>
      <div>
        <span class="label">性别（用于确定默认退休年龄）</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="option in [
              { key: 'female' as Gender, label: '女性', age: 55 },
              { key: 'male' as Gender, label: '男性', age: 60 },
            ]"
            :key="option.key"
            type="button"
            :class="
              cn(
                'rounded-xl border px-3 py-2.5 text-sm transition-colors',
                form.gender === option.key
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20',
              )
            "
            @click="pickGender(option.key)"
          >
            {{ option.label }}
            <span class="ml-1 text-[11px] opacity-60">{{ option.age }} 岁</span>
          </button>
        </div>
        <p class="mt-1.5 text-[11px] text-slate-500">
          男女法定退休年龄不同，这里只是帮你选个默认值，下一步可以改成你实际打算退休的年龄。
        </p>
      </div>
    </div>

    <div v-else-if="step === 1" class="space-y-4">
      <div>
        <label class="label" for="ob-age">计划退休年龄</label>
        <NumberField
          id="ob-age"
          v-model="form.retireAge"
          :scale="1"
          :min="45"
          :max="70"
          suffix="岁"
          size="lg"
        />
        <p class="mt-1.5 text-[11px] text-slate-500">
          中国法定退休年龄正在渐进式延迟，这里填你「实际打算退出全职工作」的年龄即可。
        </p>
      </div>
      <div>
        <label class="label" for="ob-city">所在城市</label>
        <div class="relative">
          <select id="ob-city" v-model="form.city" class="input appearance-none pr-9">
            <option v-for="city in CITIES" :key="city.code" :value="city.code">
              {{ city.name }} · 社平 ¥{{ city.avgSalary.toLocaleString('zh-CN') }}/月
            </option>
          </select>
          <MapPin class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
        <p class="mt-1.5 text-[11px] text-slate-500">
          用 {{ cityInfo.name }} 的社平工资 ¥{{ cityInfo.avgSalary.toLocaleString('zh-CN') }} 作为测算基准。
          数据为公开资料整理，仅供参考。
        </p>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="ob-salary">现在月薪（税前）</label>
          <NumberField id="ob-salary" v-model="form.monthlySalary" prefix="¥" suffix="元/月" />
          <p class="mt-1.5 text-[11px] text-slate-500">工资越高，未来养老金越多；社保缴费有上限。</p>
        </div>
        <div>
          <label class="label" for="ob-years">已缴社保年限</label>
          <NumberField id="ob-years" v-model="form.yearsContributed" :scale="1" :max="40" suffix="年" />
          <p class="mt-1.5 text-[11px] text-slate-500">不确定就填个大概，缴得越久养老金越多。</p>
        </div>
      </div>
      <div>
        <label class="label" for="ob-target">退休后每月希望花多少（按今天物价）</label>
        <NumberField id="ob-target" v-model="form.monthlyTargetExpense" prefix="¥" suffix="元/月" size="lg" />
        <p class="mt-1.5 text-[11px] text-slate-500">
          建议参考当前月支出的 70%–90%。这个数字会直接决定你的缺口有多大。
        </p>
      </div>
      <div class="flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-[12px] leading-relaxed text-emerald-200/80">
        <Sparkles class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>点「开始倒计时」，你会直接看到三件事：退休后社保发多少、每月还差多少、现在该存多少。看不明白的词，鼠标移到 ⓘ 上就有解释。</span>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-[12px] text-rose-400">{{ error }}</p>

    <div class="mt-6 flex items-center justify-between gap-3">
      <button type="button" class="btn-quiet px-2 text-[12px] text-slate-500" @click="skip">
        跳过，先看演示数据
      </button>
      <div class="flex items-center gap-2">
        <button
          v-if="step > 0"
          type="button"
          class="btn-ghost"
          @click="step -= 1"
        >
          <ArrowLeft class="h-3.5 w-3.5" />
          上一步
        </button>
        <button type="button" class="btn-primary" @click="next">
          {{ step === 2 ? '开始倒计时' : '下一步' }}
          <ArrowRight v-if="step < 2" class="h-3.5 w-3.5" />
          <Check v-else class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </AppDialog>
</template>
