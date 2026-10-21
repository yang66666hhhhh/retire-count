import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

/**
 * GitHub Pages 之类子路径部署时：VITE_BASE=/retire-count/ npm run build
 * Vercel / Netlify 根路径部署无需设置。
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`.replace('//', '/'),
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'RetireCount · 退休倒计时',
        short_name: 'RetireCount',
        description: '退休倒计时与退休生活规划工具，数据全部保存在本机。',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    {
      // 体积守门：构建结束打印 gzip 报告（不做断言，断言在 npm run size）
      name: 'retire-count-size-hint',
      apply: 'build',
      closeBundle() {
        // 由 scripts/check-size.mjs 负责详细报告
      },
    } satisfies Plugin,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'charts'
          }
          return undefined
        },
      },
    },
  },
})
