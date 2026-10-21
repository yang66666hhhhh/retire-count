<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { WifiOff } from 'lucide-vue-next'
import { pushToast } from '@/composables/useToast'

const offline = ref(false)

function sync() {
  const nowOffline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (nowOffline && !offline.value) {
    pushToast('已离线，数据保存在本机，功能照常可用', { duration: 4200 })
  }
  offline.value = nowOffline
}

onMounted(() => {
  sync()
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', sync)
  window.removeEventListener('offline', sync)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="offline"
      class="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-[12px] text-amber-200 backdrop-blur"
      role="status"
    >
      <WifiOff class="h-3.5 w-3.5" />
      <span>已离线 · 数据保存在本机，刷新后依然在</span>
    </div>
  </Transition>
</template>
