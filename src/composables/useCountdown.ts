import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const MS_PER_SECOND = 1000

/**
 * 倒计时：每秒由 Date.now() 重新计算，不做「减一」累加，避免长时间挂起后漂移。
 * 页面隐藏时停表，可见时立刻校准。
 */
export function useCountdown(target: () => Date) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  const tick = () => {
    now.value = Date.now()
  }

  const start = () => {
    stop()
    tick()
    timer = setInterval(tick, MS_PER_SECOND)
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      start()
    } else {
      stop()
    }
  }

  onMounted(() => {
    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  const remaining = computed(() => Math.max(0, target().getTime() - now.value))
  const isRetired = computed(() => remaining.value <= 0)

  const totalSeconds = computed(() => Math.floor(remaining.value / MS_PER_SECOND))
  const days = computed(() => Math.floor(totalSeconds.value / 86400))
  const hours = computed(() => Math.floor((totalSeconds.value % 86400) / 3600))
  const minutes = computed(() => Math.floor((totalSeconds.value % 3600) / 60))
  const seconds = computed(() => totalSeconds.value % 60)

  return { now, remaining, isRetired, days, hours, minutes, seconds }
}
