import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import './style.css'
import { pinia } from './stores'

createApp(App).use(pinia).mount('#app')

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}
