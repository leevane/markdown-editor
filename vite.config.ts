// 包自己的构建配置（库模式）。与 demo 根目录的 vite.config.js 是两份东西：
// 根配置产出一个可部署的站点，这里只产出一个可被 import 的 ESM 模块 + 一份 CSS。
//
// 用法：在包目录下 `pnpm build`（node 会向上找到 s78/node_modules 里的 vite）。
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 必须是 external 的依赖。前三项是运行时要用的第三方库，不打进产物：
 * 否则使用方装一次 marked、包里再带一份，体积翻倍还可能版本打架。
 * vue 尤其不能打进来——打进来就是双 Vue 实例，响应式直接失效。
 *
 * turndown / turndown-plugin-gfm 也要列：它们在 core/htmlToMarkdown.ts 里是
 * 动态 import 的（首次粘贴富文本时才加载），Rollup 会单独切 chunk；
 * 不标 external 的话产物会多出几个 chunk，exports 里却没声明，使用方拿不到。
 */
const EXTERNAL = ['vue', 'marked', 'dompurify', 'turndown', 'turndown-plugin-gfm']

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    // 库模式下一个 CSS 文件就够，别按 chunk 切
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: (id) => EXTERNAL.some((dep) => id === dep || id.startsWith(dep + '/')),
      output: {
        // SFC 的 scoped 样式 + markdown.css 的全局样式会合并成这一个文件。
        // 名字固定成 style.css：vite 默认会按包名命名（markdown-editor.css），
        // 那样使用方就得记住「包名.css」这种没规律的路径，exports 里也不好写死。
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? info.name ?? ''
          return name.endsWith('.css') ? 'style.css' : '[name][extname]'
        },
      },
    },
  },
})
