import App from './App'
import { createSSRApp } from 'vue'

// uni-app Vue3 入口（HBuilderX 项目无需 package.json）
// 注意：createSSRApp 必须从 vue 显式导入，否则 H5 编译产物会出错，页面白屏。
export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
