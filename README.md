![Markdown 编辑器：左侧 Markdown 源码、右侧实时预览，工具栏可配，底部状态栏显示字数与光标位置](https://unpkg.com/@leevane/markdown-editor@1.0.1/docs/preview.png)

# @leevane/markdown-editor

基于 Vue 3 的 Markdown 编辑器组件：左侧编辑、右侧实时预览，工具栏可裁剪，内置中英文界面，
预览 HTML 统一经 DOMPurify 净化后输出。

- 分屏 / 纯编辑 / 纯预览三种显示模式，正文通过 `v-model` 双向绑定
- 工具栏按「组名 + 工具 id」配置，支持插入自定义按钮
- 界面语言由 `language` 整体切换，个别文案可单独覆盖
- 粘贴富文本自动转换为 Markdown，`turndown` 在首次使用时动态加载
- 快捷键、撤销合并窗口、预览防抖均提供默认值，无需配置即可使用
- 品牌主色可替换，激活态文字颜色按对比度自动选择

仓库：[GitHub](https://github.com/leevane/markdown-editor) · [问题反馈](https://github.com/leevane/markdown-editor/issues) · [更新日志](https://github.com/leevane/markdown-editor/blob/main/CHANGELOG.md)

## 安装

```bash
pnpm add @leevane/markdown-editor
```

`vue` 为 peer 依赖（`^3.4`），由宿主应用提供。

## 快速开始

```vue
<script setup>
import { ref } from 'vue'
import MarkdownEditor from '@leevane/markdown-editor'
import '@leevane/markdown-editor/style.css'

const doc = ref('# 标题\n\n正文 **加粗**')
</script>

<template>
  <MarkdownEditor v-model="doc" style="height: 420px" />
</template>
```

**样式文件必须引入一次。** 库模式构建下 CSS 不会自动注入；`style.css` 同时包含外壳样式与
预览区排版，引入该文件即可完整显示。

若仅需预览区排版、外壳由使用方自行实现，引入 `markdown.css`（只包含 `.md-body` 预览样式）：

```js
import '@leevane/markdown-editor/markdown.css'
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `modelValue` | `string` | `''` | 正文，配合 `v-model` |
| `mode` | `'edit' \| 'split' \| 'preview'` | `'split'` | 受控时配合 `v-model:mode` |
| `height` | `string \| number` | — | 分屏区高度，数字按 px 处理 |
| `width` | `string \| number` | — | 编辑器宽度，数字按 px 处理 |
| `placeholder` | `string \| null` | 语言包默认 | 传 `''` 表示不显示占位文案 |
| `readonly` | `boolean` | `false` | 只读：隐藏插入类工具，保留模式切换 |
| `showToolbar` | `boolean` | `true` | 是否显示工具栏 |
| `showStatus` | `boolean` | `true` | 是否显示底部字数 / 行数 / 光标位置 |
| `showMode` | `boolean` | `true` | 是否显示模式切换按钮组 |
| `showLabels` | `boolean` | `true` | 是否显示「源码」/「预览」两栏标题 |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | `auto` 跟随 `prefers-color-scheme` |
| `accentColor` | `string` | `#46ba86` | 品牌主色，见「主题与品牌色」 |
| `language` | `'zh' \| 'en' \| string` | `'zh'` | 未注册的语言码回退为中文 |
| `idPrefix` | `string` | — | 标题 id 前缀，同页多实例时用于避免 id 重复 |
| `pasteHtml` | `boolean` | `true` | 粘贴富文本时转换为 Markdown |
| `uploadImage` | `(file) => Promise<string \| { url, alt? }>` | — | 图片上传适配器，见「图片上传」 |
| `renderDelay` | `number` | `120` | 预览渲染防抖毫秒数，`0` 关闭（字数统计始终实时） |
| `maxLength` | `number` | `0` | 字数上限，只提示不截断；`0` / 负数表示不限制 |
| `showFullscreen` | `boolean` | `true` | 是否显示全屏按钮 |
| `fullscreen` | `boolean` | 不传即组件自管 | 全屏状态，配合 `v-model:fullscreen` |
| `undoMergeWindow` | `number` | `800` | 连续输入合并为一步撤销的时间窗口，`0` 表示逐字撤销 |
| `shortcuts` | `false \| object` | 内置四个动作 | 格式快捷键，见「快捷键与撤销粒度」 |
| `toolbar` | `ToolbarItem[]` | `DEFAULT_TOOLBAR` | 工具栏配置，见「工具栏」 |
| `texts` | `MarkdownEditorTexts` | — | 逐句覆盖文案，优先级高于 `language` |
| `renderOptions` | `MarkdownRenderOptions` | — | 透传给 `renderMarkdown` |

## 事件

| 事件 | 参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string` | 正文变化 |
| `update:mode` | `'edit' \| 'split' \| 'preview'` | 显示模式变化 |
| `update:fullscreen` | `boolean` | 全屏状态变化（点击按钮或按 Esc） |
| `change` | `string` | 与 `update:modelValue` 同时触发，便于单独绑定业务逻辑 |
| `paste-image` | `File[]` | 粘贴图片文件；仅在未配置 `uploadImage` 时触发 |
| `drop-image` | `File[]` | 拖入图片文件；仅在未配置 `uploadImage` 时触发 |
| `upload-error` | `(file: File, error: unknown)` | 适配器抛错或返回空地址；占位已被移除 |

上传职责有两种划分方式：不传 `uploadImage` 时组件只抛出文件列表，存储与插入由宿主完成；
传入适配器后组件接管占位与回填，网络请求仍在宿主侧。详见「图片上传」。

## 实例方法

```vue
<MarkdownEditor ref="editorRef" v-model="doc" />

<script setup>
import { ref } from 'vue'

const editorRef = ref(null)
</script>
```

| 方法 | 返回值 | 说明 |
|---|---|---|
| `focus()` | `void` | 聚焦编辑区 |
| `getHtml()` | `string` | 当前预览 HTML，已净化，可直接插入页面 |
| `insert(text)` | `boolean` | 在光标处插入文本；只读状态返回 `false` |
| `pickImage()` | `boolean` | 打开文件选择框并走 `uploadImage`；未配置适配器或只读时返回 `false` |
| `undo()` / `redo()` | `void` | 撤销 / 重做 |
| `setMode(mode)` | `void` | 切换显示模式 |

## 图片上传

组件不发起网络请求，但可以接管占位与回填。向 `uploadImage` 传入适配器后，
粘贴、拖入、点击工具栏图片按钮三条入口统一走它：

```vue
<MarkdownEditor v-model="doc" :upload-image="upload" @upload-error="onError" />
```

```ts
async function upload(file: File) {
  const { url } = await api.put(file) // 鉴权、压缩、CDN 由宿主决定
  return { url, alt: file.name } // 也可以只返回 url 字符串
}
```

单个文件的生命周期：

1. 在光标处插入占位 `![cover.png](uploading:u1)`，`alt` 取文件名去掉扩展名；
2. 调用适配器，等待地址；
3. 成功：占位整段替换为 `![alt](url)`，位置不变；
4. 失败（抛错或返回空地址）：删除占位并复原两侧空行，触发 `upload-error`。

行为约定：

- **占位固定在正文里**。回填按 token 定位，上传期间新增的内容原样保留；占位若被撤销或删除，
  则放弃插入，不会把图片补到无关位置。
- **不抢焦点**。上传是后台完成的，落盘时只改正文并按位移调整光标；输入法组字期间结果延后到
  `compositionend` 再写入，避免打断组字。
- **多张一起选**时所有占位一次排好，不会边传边插打乱正在写的内容；状态栏显示「正在上传 N」。
- **失败的占位会被清掉**，正文回到上传前的状态，不保留坏图。
- 未配置适配器时保持原行为：只触发 `paste-image` / `drop-image`，由宿主上传后调用 `insert()`。
- 工具栏图片按钮在配置适配器后由「插入语法模板」变为「打开文件选择框」；宿主自有按钮可调用
  `pickImage()`。只读状态下 `pickImage()` 返回 `false`，粘贴与拖入不触发上传。

## 界面语言

内置 `zh` 与 `en`：

```vue
<MarkdownEditor language="en" />
```

新增语言无需修改组件源码：

```ts
import { registerLocale } from '@leevane/markdown-editor'
import type { ResolvedTexts } from '@leevane/markdown-editor'

registerLocale('ja', JA_TEXTS satisfies ResolvedTexts)
```

`ResolvedTexts` 要求全部字段齐备，缺少任一键即为编译错误，可避免部分文案回退为默认语言。
新语言包可以 `ZH_TEXTS` 为基础展开后逐项替换，既保证字段完整，也无需从空白开始。

仅需修改个别文案时（例如将「字数」改为「字符数」），使用 `texts`：

```vue
<MarkdownEditor :texts="{ wordsLabel: '字符数' }" />
```

> `registerLocale` 写入的是模块级注册表。浏览器环境下无副作用；SSR 环境下多个请求共享同一进程，
> 应在应用启动时统一注册，不应在请求处理过程中动态注册。

## 工具栏

配置项可以是组名、单个工具 id、`'sep'`（分隔线）或自定义按钮对象：

```vue
<MarkdownEditor :toolbar="['history', 'bold', 'italic', 'sep', 'link', {
  key: 'preview-link',
  icon: '<path d="M4 12h16"/>',
  title: '在预览中打开',
  onClick: () => window.open('/preview'),
}]" />
```

- 组名：`history` / `heading` / `block` / `inline` / `style`
- 工具 id：`undo` `redo` `heading` `size` `color` `bg` `quote` `ul` `ol` `task` `hr` `table`
  `bold` `italic` `strike` `inlineCode` `codeBlock` `link` `image`
- 不传 `toolbar` 时渲染全量内置项（`DEFAULT_TOOLBAR`，可 `import` 后增删）

## 快捷键与撤销粒度

默认键位为 `mod+b` / `mod+i` / `mod+k` / `mod+e`，分别对应加粗、斜体、链接、行内代码；
`mod` 在 Windows / Linux 下为 Ctrl，在 macOS 下为 ⌘。

```vue
<!-- 仅修改加粗，其余三个保持默认 -->
<MarkdownEditor :shortcuts="{ bold: 'mod+shift+b' }" />

<!-- 移除斜体的快捷键，其余保持默认 -->
<MarkdownEditor :shortcuts="{ italic: false }" />

<!-- 全部关闭 -->
<MarkdownEditor :shortcuts="false" />
```

修饰键按完全一致匹配：配置为 `mod+b` 时仅响应 Ctrl+B / ⌘+B，按下 Ctrl+Shift+B 不会命中，
因此 `mod+b` 与 `mod+shift+b` 可以分别绑定不同动作。支持 `mod`、`ctrl`、`meta`、`shift`、`alt`
（`command`、`option` 亦可识别）；单键（如 `'b'`）不受支持，以免干扰正常输入。

**工具栏悬浮提示会随配置更新。** 语言包中只保存工具名（如「加粗」），其后的 `(Ctrl+B)` 由组件按
当前键位实时计算：改为 `mod+shift+b` 后提示变为「加粗 (Ctrl+Shift+B)」；某动作传 `false` 关闭后，
后缀随之消失，不会出现提示与按键行为不一致的情况。

自定义工具栏按钮可复用同一套格式化逻辑：

```ts
import { formatShortcut } from '@leevane/markdown-editor'

formatShortcut('mod+shift+b')   // 'Ctrl+Shift+B'
formatShortcut('cmd+k')         // '⌘+K'
formatShortcut(false)           // ''（调用方据此省略后缀）
```

撤销粒度：默认将 800 ms 内的连续输入合并为一步撤销，空白字符与中英文标点会中断合并。

```vue
<!-- 逐字撤销：每次改动单独成一步 -->
<MarkdownEditor :undo-merge-window="0" />

<!-- 放宽到 2 秒：慢速输入时历史记录不会被拆得过细 -->
<MarkdownEditor :undo-merge-window="2000" />
```

`Ctrl+Z` / `Ctrl+Y` 不可配置：二者需与组件内部历史栈同步，交由浏览器原生撤销会与内部栈错位。

## 字数上限与全屏

### 字数上限

`maxLength` 只做提示，不截断输入：

```vue
<MarkdownEditor v-model="doc" :max-length="500" />
```

- 状态栏显示为「字数 128 / 500」，超出后数字改用 `--md-danger`；
- 根节点同时带 `data-over-limit="true"`，宿主可据此禁用发布按钮或追加提示；
- 计数口径与状态栏一致（中文按字、英文按词，即 `countWords`）；
- `0`、负数与非有限数一律视为不限制。

不在输入层截断，是因为截断会与光标位置、撤销栈、输入法组字三处冲突，被吞掉的半句话还需用户重写。
需要硬性拦截时，在业务侧用同一个 `countWords` 判断即可。

该能力默认关闭，只为「版位固定」的场景提供：公告栏、摘要字段、SEO 描述、评论区等有明确长度约束的输入框。
面向长文的写作台（如 CSDN 一类的编辑器）不应设置上限，保持默认值 `0` 即可。

### 全屏

```vue
<!-- 不受控：点击按钮即切换，状态由组件维护 -->
<MarkdownEditor v-model="doc" />

<!-- 受控：状态由父组件决定 -->
<MarkdownEditor v-model="doc" v-model:fullscreen="isFullscreen" />
```

- 全屏时容器改为 `position: fixed; inset: 0`，宽高由视口决定，`height` / `width` 不再生效；
- 进入后锁定 `body` 滚动，退出或卸载时恢复原值；
- 按 Esc 退出，并触发 `update:fullscreen(false)`；
- 进入时聚焦编辑区；首屏即为全屏时不抢占焦点；
- `showFullscreen="false"` 仅隐藏按钮，仍可通过 `fullscreen` 控制状态；按钮位于工具栏内，
  `showToolbar` 与 `showMode` 同时关闭时整条工具栏不渲染，按钮也随之隐藏。

## 主题与品牌色

内置主色为绿色 `#46ba86`。接入既有系统时，通常需要让工具栏激活态、模式切换选中项、输入框聚焦
边框、正文链接与引用块淡底跟随站点品牌色：

```vue
<MarkdownEditor accent-color="#2563eb" />
```

`accentColor` 接受任意 CSS 颜色（`#2563eb`、`rgb(37 99 235)` 等）。以下行为自动完成：

- **亮色与深色主题同时生效。** 变量写入根节点内联样式，优先级高于任何选择器，
  无需为 `theme="dark"` 重复配置。
- **激活态文字颜色自动确定。** 实底按钮为「主色底 + 反色文字」。以浅黄 `#fbbf24` 为例，
  白字对比度仅 1.67:1，可读性不足；组件依据 WCAG 相对亮度计算应使用白字还是 `#111827`，
  结果写入 `--md-accent-contrast`。策略为白字优先，仅当白字对比度低于 2.4:1 时改用深色文字：
  内置绿为 2.43:1，保留白字；浅黄 1.67:1、浅蓝 `#7dd3fc` 1.67:1，切换为深色文字。
- **引用块与提示块的淡底由主色混合生成**（`color-mix()`），不再是固定淡绿，更换蓝色品牌色后
  不会残留绿色调。不支持 `color-mix()` 的浏览器回退为固定值。

文字颜色判据同样对外导出，自绘实底按钮时可直接复用：

```ts
import { readableTextColor, contrastRatio } from '@leevane/markdown-editor'

readableTextColor('#fbbf24')                    // '#111827'
readableTextColor('#2563eb')                    // '#ffffff'
readableTextColor('#46ba86', { minLight: 4.5 }) // '#111827'（按 WCAG 小字标准收紧）
contrastRatio([37, 99, 235], [255, 255, 255])   // 5.17
```

仅需调整个别颜色时（而非整套更换品牌色），在宿主 CSS 中覆盖变量即可，无需传入 prop：

```css
.md-editor {
  --md-accent: #2563eb;
  --md-border: #e3e8ef;
}
```

该写法可以直接生效：组件将变量层包裹在 `:where()` 中，特异性降至 0，宿主的一条普通规则即可覆盖，
无需 `!important`，也无需了解 `data-v-*` 属性。

| 变量 | 作用 |
|---|---|
| `--md-accent` | 主色：激活态底色、聚焦边框、正文链接、引用块竖线 |
| `--md-accent-contrast` | 主色底上的文字颜色（传入 `accentColor` 时自动计算） |
| `--md-surface` / `--md-bar-bg` / `--md-hover` | 面板底色 / 工具栏底色 / 悬停底色 |
| `--md-text` / `--md-text-strong` / `--md-muted` | 正文 / 强调 / 次要文字 |
| `--md-border` / `--md-border-soft` | 边框 / 分隔线 |
| `--md-danger` | 超限提示色（状态栏字数） |
| `--md-radius` | 圆角 |

## 纯函数

渲染逻辑与组件解耦，可脱离组件单独使用：

```ts
import { renderMarkdown, buildToc, countWords, detectActive } from '@leevane/markdown-editor'

const html = renderMarkdown(md)   // 已按内置白名单净化
const toc = buildToc(html)        // [{ level, text, id }]
countWords(md)                    // 字数（中文按字，英文按词）
```

其余导出包括 `continueList` / `indentSelection` / `setHeading` / `insertBlock` 等选区操作，
入参与出参均为纯数据（`{ value, selectionStart, selectionEnd }`），便于单元测试。

配色相关的四个函数（`parseColor` / `relativeLuminance` / `contrastRatio` / `readableTextColor`）
见「主题与品牌色」一节。

图片占位同样以纯函数导出（`imagePlaceholder` / `findImagePlaceholder` / `insertImagePlaceholder` /
`replaceImagePlaceholder` / `removeImagePlaceholder` / `defaultImageAlt`），
宿主自建上传界面时可复用这套定位与回填逻辑。

## SSR

组件可在无 DOM 环境下完成 `renderToString`（不会抛出异常），但**预览区输出为空**：
净化依赖 DOMPurify，服务端缺少 DOM，无法安全渲染，需等待客户端挂载后补齐。

若需在服务端输出正文，请直接调用 `renderMarkdown`。需要注意：**无 DOM 时该函数跳过净化**，
返回的是 marked 原始输出，不应直接下发至浏览器。

## 体积与兼容性

| 文件 | 大小 | gzip |
|---|---|---|
| `index.js` | 55.7 kB | 18.8 kB |
| `style.css` | 8.8 kB | 2.3 kB |
| `markdown.css` | 5.3 kB | 2.3 kB |

体积按 1024 字节计；npm 页面按 1000 字节折算，显示的 `dist/index.js` 会略大（约 56.9 kB）。
产物附带 sourcemap（`index.js.map`，不随 `exports` 引入），便于使用方在构建链里直接定位源码。

`vue` / `marked` / `dompurify` / `turndown` 均为 external 依赖，不会重复打包。
`turndown` 以动态 import 加载，仅在首次粘贴富文本时请求。

运行环境要求 `ES2020`（Chrome 90+ / Safari 14+ / Firefox 90+）。
引用块淡底使用 `color-mix()`（Chrome 111+ / Safari 16.2+ / Firefox 113+），
旧版浏览器回退为固定淡绿，功能不受影响，仅不随主色变化。

## 发布

### 首次发布前的准备

| # | 事项 | 做法 |
|---|---|---|
| 1 | npm 账号 + 2FA | 账号已启用 passkey 两步验证（Windows Hello）。上传阶段不需要动态码，批准暂存版本时在浏览器里用指纹确认；纯 TOTP 账号可用 `npm publish --otp=123456` |
| 2 | 本机登录 | `npm login`（npm 10 走浏览器授权），随后 `npm whoami` 应返回用户名 |
| 3 | 包名是否可用 | `npm view @leevane/markdown-editor version`，返回 404 才是可用 |
| 4 | 作用域归属 | 作用域 `@leevane` 是 npm 组织，发布账号必须是该组织成员：`npm org ls leevane` 能看到自己的用户名才可发布。作用域与用户名不一致时，scoped 包不能直接发 |
| 5 | 仓库地址 | 仓库为 `https://github.com/leevane/markdown-editor`，`repository` / `homepage` / `bugs` 三项已写入 `package.json`；包页右侧的 Repository、Homepage、Issues 入口全部由这三项生成 |

### 每次发布

```bash
npm run build          # 构建 + 4 项产物断言
npm run check:publish  # 8 项发布校验，可单独运行
npm publish            # 触发 prepublishOnly：重新构建后再校验，产物进入暂存队列
```

`npm publish` 返回 `+ @leevane/markdown-editor@x.y.z` 只代表**上传成功**，版本此时尚未对外开放，
还需在 npmjs.com 批准一次暂存版本（见下节）。

版本号遵循语义化版本。发版前先在 `CHANGELOG.md` 顶部补一条记录：`prepublishOnly` 会比对
「首条版本号」与 `package.json` 的 `version`，不一致直接拦截，避免出现「发出去的版本在变更记录里查不到」。

`prepublishOnly` 会重新执行一遍构建，因此不会把过期的 `dist` 发出去。8 项校验：

| # | 校验 | 拦截的典型事故 |
|---|---|---|
| 1 | 版本号与 `CHANGELOG.md` 首条一致 | 发出去的版本没有对应的变更记录 |
| 2 | `exports` / `main` / `types` 指向的文件存在且非空 | 路径写错，安装后才报找不到模块 |
| 3 | `files` 覆盖 `dist`、`CHANGELOG.md`、`docs` | tarball 漏产物或漏配图 |
| 4 | 依赖无 `file:` / `link:` / `workspace:` | 装包方拿到空壳 |
| 5 | `marked` / `dompurify` / `turndown` 已在 `dependencies` 声明 | 产物是 external 的，使用方装不上就跑不起来 |
| 6 | README 非空 | npm 页面没有文档 |
| 7 | README 图片为绝对 https 地址、URL 版本号与 `package.json` 一致、源文件存在 | 包页配图 404，或升版后图仍指向旧版本 |
| 8 | `repository` / `homepage` / `bugs` 齐全、均为 https、且与仓库路径一致 | 包页缺少仓库与 Issue 入口，或改名后链接指向不存在的仓库 |

本包为 scoped 包，`publishConfig.access` 已设为 `public`，无需额外传 `--access public`。

### 暂存发布（staged publishing）

npm 对命令行 / token 发起的发布会先进**暂存队列**，人工确认两步验证后才对外开放。
本包 1.0.0 即按此流程上线，实际经历是：

| 步骤 | 现象 |
|---|---|
| 1. `npm publish` | 返回 `+ @leevane/markdown-editor@1.0.0`，并提示 `Your package is being processed` |
| 2. 查 registry | `npm view <包名> version` 返回 `0.0.0-stage`，`1.0.0` 仍 404 |
| 3. 批准 | npmjs.com → **Packages → Staged Packages** → 找到该版本 → **Approve**，过 2FA |
| 4. 生效 | `latest` 指向 `1.0.0`，占位版本消失，tarball 与配图立即可取 |

几个容易误判的点：

- **`0.0.0-stage` 不是发错版本**。它是 npm 自动创建的占位包，描述为
  `Temporary package placeholder for staged publishing`，批准后会被替换。
- **暂存队列按 owner 分开**。组织包要在组织维度看：`npmjs.com/settings/<org>/staged`，
  个人账号的 Staged Packages 页面里看不到组织包。
- **带 bypass 2FA 的 token 只能上传、不能批准**。这是 npm 的设计：token 泄露也发不了版，
  2FA 闸门被后移到批准环节。因此批准必须在浏览器里完成（或 CLI `npm stage approve` +
  TOTP，需 npm ≥ 11.15）。

### 关于 README 配图

包页顶部的示意图存放在 `docs/preview.png`，随包一起发布（`files` 里含 `docs`），
README 用绝对地址引用：

```
https://unpkg.com/@leevane/markdown-editor@1.0.1/docs/preview.png
```

- **必须使用绝对地址**。npm 从 tarball 渲染 README，脱离仓库上下文，`./docs/preview.png`
  这类相对路径在包页上必然 404（在 GitHub 上却是正常的，所以本地很难发现）。
- **为什么用 unpkg 而不是 GitHub raw**。本机与部分网络环境访问 `raw.githubusercontent.com`
  与 `cdn.jsdelivr.net` 会失败，unpkg 直接读取 npm 包内容，发布后立即可用。
- **升版时要同步 URL 里的版本号**。第 7 项校验会比对版本号，写错会在发布前报出来。
- **仓库已建，此处仍用 unpkg**。仓库为 `leevane/markdown-editor`，GitHub raw 也可用
  （`https://raw.githubusercontent.com/leevane/markdown-editor/main/docs/preview.png`），
  但要求图片已提交到 `main` 分支；改用 raw 后可从 `files` 中移除 `docs`，tarball 小约 170 kB，
  代价是包页配图依赖 GitHub 的可用性。当前配置选择「图随包走」，包页与 tarball 内容一致。

## 已知限制

以下行为由源码固定实现，调整需修改组件：

- `Ctrl+Z` / `Ctrl+Y` 不可配置（需同步内部历史栈）
- 正文行内代码的文字颜色为语义色，不随 `accentColor` 变化；如需调整，覆盖 `--md-body-code-text`
- 表格仅支持插入 Markdown 源码，无可视化编辑
- 图片上传不含压缩、裁剪、进度百分比与失败重试，这些应在 `uploadImage` 适配器内实现
- `registerLocale` 为模块级注册表，SSR 下多请求共享，应在应用启动时统一注册

## License

MIT
