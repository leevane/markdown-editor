// 文件：vitest.config.js
// 组件单测环境：jsdom + @vitejs/plugin-vue。
// 与 vite.config.ts（库模式构建）分开，避免测试相关依赖混进生产构建。
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.js'],
    // 组件里用了 requestAnimationFrame 还原光标，jsdom 有实现，这里只需给点余量
    testTimeout: 10000,
  },
})
