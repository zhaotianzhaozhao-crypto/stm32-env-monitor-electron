import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'

export default defineConfig({
  // 使用相对路径，让打包后的 index.html 在 file:// 协议下也能正确加载资源
  base: './',
  plugins: [
    vue(),
    electron({
      entry: 'main.cjs',
    }),
  ],
})
