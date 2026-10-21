// 一次性脚本：把 public/icon.svg 转成 PWA 需要的 PNG
// 用法：npm run icons
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const svg = readFileSync(resolve(publicDir, 'icon.svg'))

mkdirSync(publicDir, { recursive: true })

async function build() {
  await sharp(svg).resize(192, 192).png().toFile(resolve(publicDir, 'pwa-192.png'))
  await sharp(svg).resize(512, 512).png().toFile(resolve(publicDir, 'pwa-512.png'))
  await sharp(svg).resize(180, 180).png().toFile(resolve(publicDir, 'apple-touch-icon-180.png'))

  // maskable：内容缩到 80% 居中，四周留安全边距，避免被系统裁成圆形时切掉沙漏
  const inner = 410
  const pad = Math.round((512 - inner) / 2)
  const innerPng = await sharp(svg).resize(inner, inner).png().toBuffer()
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([{ input: innerPng, top: pad, left: pad }])
    .png()
    .toFile(resolve(publicDir, 'maskable-512.png'))

  console.log('icons generated: pwa-192.png, pwa-512.png, maskable-512.png, apple-touch-icon-180.png')
}

build().catch((error) => {
  console.error(error)
  process.exit(1)
})
