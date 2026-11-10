/**
 * 渲染进程入口：挂载 App，注入全局 styles.css。
 * Electron 下由主窗口加载 dist/index.html；开发态走 Vite。
 */
import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')
