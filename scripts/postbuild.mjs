// 构建收尾：把预览样式单独放一份到 dist 根，并做三条产物断言。
//
// 为什么单独放 markdown.css：组件内部的 `import './styles/markdown.css'`
// 会被 vite 抽进 style.css（和 scoped 外壳样式合并）。但有些使用方不想整体
// 引入 style.css（比如自己复刻了外壳、只借用预览排版），所以再给一个
// `@wenxuan/markdown-editor/markdown.css` 的入口。
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')

const fail = (msg) => {
  console.error(`[postbuild] ${msg}`)
  process.exit(1)
}

// 1) 预览样式单独一份
copyFileSync(join(root, 'src/styles/markdown.css'), join(dist, 'markdown.css'))

// 2) 三个出口都得在
for (const f of ['index.js', 'index.d.ts', 'style.css', 'markdown.css']) {
  const p = join(dist, f)
  if (!existsSync(p)) fail(`缺少产物 ${f}`)
  if (statSync(p).size === 0) fail(`产物 ${f} 是空文件`)
}

// 3) 第三方库不能被打进产物（打进来就失去 external 的意义）
const js = readFileSync(join(dist, 'index.js'), 'utf8')
for (const dep of ['marked', 'dompurify', 'turndown']) {
  if (js.includes(`from "${dep}"`) || js.includes(`from '${dep}'`)) continue
  // 动态 import 也算（turndown 是懒加载的）
  if (js.includes(`import("${dep}")`) || js.includes(`import('${dep}')`)) continue
  fail(`产物里没找到对 ${dep} 的外部引用，可能被内联了`)
}

// 4) 预览样式必须在 style.css 里（否则使用方只引 style.css 时预览没排版）
const css = readFileSync(join(dist, 'style.css'), 'utf8')
if (!css.includes('.md-body')) fail('style.css 里没有 .md-body，预览样式丢了')

const kb = (f) => `${(statSync(join(dist, f)).size / 1024).toFixed(1)}kB`
console.log(`[postbuild] index.js ${kb('index.js')} / style.css ${kb('style.css')} / markdown.css ${kb('markdown.css')} — 4 项检查通过`)
