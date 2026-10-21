<script setup lang="ts">
import HomeView from './views/HomeView.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import ToastHost from './components/ui/ToastHost.vue'
</script>

<template>
  <HomeView />
  <ToastHost />
  <OfflineBanner />
</template>
