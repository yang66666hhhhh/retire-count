<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  RotateCcw,
  Upload,
  X,
} from 'lucide-vue-next'
import AppDialog from './ui/AppDialog.vue'
import { useUserProfile } from '@/stores/userProfile'
import { useFinancePlan } from '@/stores/financePlan'
import { useLifePlans } from '@/stores/lifePlans'
import { clearAllPersisted, flushPersist } from '@/stores'
import {
  backupFileName,
  buildBackup,
  downloadBackup,
  parseBackup,
  readFileAsText,
  summarizeBackup,
  type BackupSummary,
} from '@/utils/exportData'
import { pushToast } from '@/composables/useToast'
import type { BackupFile, ImportMode } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const profile = useUserProfile()
const finance = useFinancePlan()
const plans = useLifePlans()

const fileInput = ref<HTMLInputElement | null>(null)
const pickedFile = ref<BackupFile | null>(null)
const summary = ref<BackupSummary | null>(null)
const issues = ref<string[]>([])
const errorMessage = ref('')
const resetStage = ref(false)
const resetConfirm = ref('')

const exportName = computed(() => backupFileName())

const canReset = computed(() => resetConfirm.value.trim() === '重置')

watch(
  () => props.open,
  (open) => {
    if (open) {
      clearImport()
      resetStage.value = false
      resetConfirm.value = ''
      errorMessage.value = ''
    }
  },
)

function clearImport() {
  pickedFile.value = null
  summary.value = null
  issues.value = []
  errorMessage.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function exportNow() {
  flushPersist()
  const file = buildBackup(profile.$state, finance.$state, plans.$state)
  const name = downloadBackup(file)
  pushToast(`已导出 ${name}`, { tone: 'success' })
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = ''
  issues.value = []
  pickedFile.value = null
  summary.value = null

  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = '文件超过 2MB，可能不是本应用的备份文件'
    return
  }

  try {
    const text = await readFileAsText(file)
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      errorMessage.value = parsed.error
      return
    }
    pickedFile.value = parsed.file
    summary.value = summarizeBackup(parsed.file)
    issues.value = parsed.issues
  } catch {
    errorMessage.value = '文件读取失败，请重试'
  }
}

function applyImport(mode: ImportMode) {
  const file = pickedFile.value
  if (!file) return

  if (mode === 'overwrite') {
    profile.applyProfile(file.data.profile)
    finance.applyFinance(file.data.finance)
    plans.applyPlans(file.data.plans)
  } else {
    // 合并：计划按 id 合并；档案仅在本机尚未建档时采用导入值；测算参数保留本机
    if (!profile.onboarded) profile.applyProfile(file.data.profile)
    plans.mergePlans(file.data.plans)
  }

  flushPersist()
  emit('update:open', false)
  pushToast(mode === 'overwrite' ? '已覆盖导入备份' : '已合并导入备份', { tone: 'success' })
  clearImport()
}

function doReset() {
  if (!canReset.value) return
  clearAllPersisted()
  profile.reset()
  finance.reset()
  plans.reset()
  flushPersist()
  emit('update:open', false)
  resetStage.value = false
  resetConfirm.value = ''
  pushToast('本地数据已清空，将重新开始引导', { tone: 'danger' })
}
</script>

<template>
  <AppDialog
    :open="props.open"
    title="备份与数据"
    description="所有数据只保存在这台设备的浏览器里。换设备、清缓存前，记得先导出一份。"
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-5">
      <!-- 导出 -->
      <section class="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-emerald-400/10 p-2 text-emerald-400">
            <Download class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-[13px] font-medium text-slate-200">导出 JSON 备份</h3>
            <p class="mt-1 text-[11.5px] leading-relaxed text-slate-500">
              包含档案、测算参数和全部生活计划，保存为
              <code class="rounded bg-white/5 px-1 py-0.5 font-mono text-[10.5px] text-slate-300">{{ exportName }}</code>
            </p>
            <button type="button" class="btn-primary mt-3" @click="exportNow">
              <Download class="h-3.5 w-3.5" />
              导出备份
            </button>
          </div>
        </div>
      </section>

      <!-- 导入 -->
      <section class="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-sky-400/10 p-2 text-sky-400">
            <Upload class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-[13px] font-medium text-slate-200">导入 JSON 备份</h3>
            <p class="mt-1 text-[11.5px] leading-relaxed text-slate-500">
              导入前会校验文件结构与字段范围，异常字段会被修正并提示。
            </p>

            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="hidden"
              @change="onFileChange"
            />
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" class="btn-ghost" @click="fileInput?.click()">
                <FileJson class="h-3.5 w-3.5" />
                选择文件
              </button>
              <button
                v-if="pickedFile"
                type="button"
                class="btn-quiet px-2 py-1.5 text-[11.5px]"
                @click="clearImport"
              >
                <X class="h-3 w-3" />
                取消选择
              </button>
            </div>

            <p v-if="errorMessage" class="mt-3 flex items-start gap-1.5 text-[11.5px] text-rose-400">
              <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {{ errorMessage }}
            </p>

            <div v-if="pickedFile && summary" class="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.05] p-3">
              <p class="flex items-center gap-1.5 text-[12px] text-sky-200">
                <CheckCircle2 class="h-3.5 w-3.5" />
                校验通过，可以导入
              </p>
              <ul class="mt-2 space-y-1 text-[11px] text-slate-400">
                <li>导出时间：{{ summary.exportedAtText }}</li>
                <li>城市：{{ summary.cityName }} · 计划 {{ summary.planCount }} 条（已完成 {{ summary.doneCount }} 条）</li>
              </ul>
              <p v-if="issues.length" class="mt-2 border-t border-white/10 pt-2 text-[10.5px] text-amber-300/80">
                已自动修正 {{ issues.length }} 处：{{ issues.slice(0, 3).join('；') }}
              </p>

              <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" class="btn-primary text-[12px]" @click="applyImport('overwrite')">
                  覆盖导入
                </button>
                <button type="button" class="btn-ghost text-[12px]" @click="applyImport('merge')">
                  合并导入
                </button>
              </div>
              <p class="mt-2 text-[10.5px] leading-relaxed text-slate-500">
                覆盖：全部替换为本机现有内容将被清除。<br />
                合并：计划按条目合并（同一条取较新版本），测算参数保留本机设置。
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 重置 -->
      <section class="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-rose-500/10 p-2 text-rose-400">
            <RotateCcw class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-[13px] font-medium text-rose-200">清空全部本地数据</h3>
            <p class="mt-1 text-[11.5px] leading-relaxed text-slate-500">
              会删除档案、测算参数和所有计划，且无法恢复。建议先导出备份。
            </p>

            <button
              v-if="!resetStage"
              type="button"
              class="btn mt-3 border border-rose-500/30 bg-rose-500/10 text-[12px] text-rose-200 hover:bg-rose-500/20"
              @click="resetStage = true"
            >
              我要清空…
            </button>

            <div v-else class="mt-3 space-y-2 rounded-lg border border-rose-500/20 bg-ink-950/40 p-3">
              <p class="text-[11.5px] text-slate-400">
                请输入「<span class="font-semibold text-rose-300">重置</span>」两个字以确认：
              </p>
              <input
                v-model="resetConfirm"
                class="input text-[12px]"
                placeholder="重置"
                autocomplete="off"
              />
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn-danger text-[12px]"
                  :disabled="!canReset"
                  @click="doReset"
                >
                  确认清空
                </button>
                <button
                  type="button"
                  class="btn-quiet text-[12px]"
                  @click="
                    () => {
                      resetStage = false
                      resetConfirm = ''
                    }
                  "
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p class="text-[10.5px] leading-relaxed text-slate-600">
        本应用没有服务器，也没有账号系统。数据一旦清空，我们无法帮你找回任何内容。
      </p>
    </div>
  </AppDialog>
</template>
