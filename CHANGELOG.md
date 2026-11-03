# 变更记录

本包遵循[语义化版本](https://semver.org/lang/zh-CN/)，记录格式参考
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

发布前由 `prepublishOnly` 校验「本文件首条版本号」与 `package.json` 的 `version` 一致，
版本对不上会直接拦截发布。

## [1.0.0] - 2026-11-03

首个版本。核心原则：**组件只负责编辑，不碰网络、不碰存储、不碰路由**；
凡是宿主有差异的地方（工具栏、文案、键位、主色、上传）都留成 props 或事件。

### 新增

**编辑器主体**

- 三种显示模式：`edit` / `split` / `preview`，支持 `v-model:mode` 受控；
  非法值回落 `split`，`readonly` 时只隐藏插入类工具，模式切换照常可用。
- 渲染链路：`marked` 解析 + `DOMPurify` 净化，`renderOptions` 原样透传（含 `extensions`，
  可挂 mermaid、脚注等 marked 插件），渲染结果带标题锚点 id，支持 `idPrefix` 避让页面已有 id。
- 预览防抖：`renderDelay` 默认 120ms，`rawHtml` 同步计算，因此 `getHtml()` 永远拿到最新内容。
- 正文样式独立成 `@layer md-body`，宿主不改权重、不用 `!important` 即可覆盖排版。

**工具栏**

- 注册表式配置：`toolbar` 接受分组名（`history` / `heading` / `block` / `inline` / `style`）、
  单个内置工具 id、`'sep'` 分隔线与自定义按钮对象混排；分组展开后自动补分隔线去重。
  内置 19 个动作：撤销、重做、标题层级、字号、字色、背景色、引用、无序/有序/任务列表、
  分割线、表格、加粗、斜体、删除线、行内代码、代码块、链接、图片。
- 激活态：由选区反推当前格式（是否加粗、当前行是否列表/引用、标题层级），
  按钮输出 `aria-pressed`，标题下拉显示当前层级而非固定「正文」。
- 自定义按钮支持 `title` / `icon`（SVG 字符串）/ `run(ctx)`，`ctx` 提供 `insert` 等方法。

**键盘与撤销**

- 默认快捷键 `mod+b` / `mod+i` / `mod+k` / `mod+e`，`shortcuts` 可整体或逐项覆盖、传 `false` 关闭；
  修饰键按「完全一致」匹配，`mod+b` 不会吞掉 `mod+shift+b`。
- 悬浮提示里的键位后缀由 `formatShortcut` 现算，改键位后提示同步变化，不会出现提示与按键不符。
- 撤销合并窗口 `undoMergeWindow`（默认 800ms，`0` 为逐字撤销），在空白与中英文标点处断句。
- `Tab` / `Shift+Tab` 缩进（有选区时整块处理），回车自动续列表（无序、有序递增、任务、引用），
  空列表项再回车退出列表。

**输入**

- 富文本粘贴：检测 `text/html` 的块级语义后交给 `turndown` 转换（懒加载，不占首屏），
  `pasteHtml="false"` 可关闭。
- 图片上传适配器 `uploadImage(file) => Promise<string | { url, alt }>`：粘贴、拖入、
  工具栏选图三条入口统一，先插占位再按 token 原地回填；失败删占位并触发 `upload-error`。
- 未配置适配器时回到事件模式：`paste-image` / `drop-image` 抛出 `File[]`，上传由宿主负责。
- 输入法（IME）组字期间不接管回车与回写，`compositionend` 后再落盘。

**主题与国际化**

- `theme` 三态：`light` / `dark` / `auto`（`auto` 走 `prefers-color-scheme`）。
- `accentColor` 配合 `core/color.ts` 自动推导前景色：白字优先，对比度低于 `minLight` 才转深字，
  避免把内置绿这类中亮度主色擅自翻成深字。
- 变量层包在 `:where()` 中，特异性为 0，宿主用普通类选择器即可覆盖。
- 内置中文与英文语言包，`language` 整套切换，`texts` 逐句覆盖，`registerLocale` 注册新语言。

**布局与状态**

- 字数上限 `maxLength`：只提示不截断，状态栏显示「字数 / 上限」，超限改用 `--md-danger`
  并在根节点落 `data-over-limit="true"`；`0`、负数与非有限数一律视为不限制。
- 全屏：受控 `v-model:fullscreen`，Esc 退出，进入时锁定页面滚动、退出或卸载时恢复；
  `showFullscreen="false"` 仅隐藏按钮。

**无障碍**

- 工具栏 `role="toolbar"`、模式组 `role="group"`、分隔线 `role="separator"`、
  预览区 `role="region"` + `tabindex="0"`、状态栏 `role="status" aria-live="polite"`；
  图标按钮均带 `aria-label`（读屏只认 label，不认 `title`）；焦点描边走 `:focus-visible`。

**对外接口**

- 实例方法：`focus()` / `getHtml()` / `insert(text)` / `undo()` / `redo()` / `setMode(mode)` / `pickImage()`。
- 事件：`update:modelValue` / `update:mode` / `update:fullscreen` / `change` / `paste-image` /
  `drop-image` / `upload-error`。
- 纯函数导出：渲染、字数、目录、选区计算、粘贴转换、快捷键解析与格式化、颜色计算、图片占位。

**打包边界**

- 独立包 `@leevane/markdown-editor`，`exports` 提供四个出口：
  `.`（JS + d.ts）、`./style.css`、`./markdown.css`、`./package.json`。
- `marked` / `dompurify` / `turndown` 全部 external，由使用方按自己的版本安装；
  `vue` 为 peerDependency（`^3.4`）。
- 类型随包发布：`.vue` 的 d.ts 能被使用方的 TypeScript 正常解析（`skipLibCheck: false` 下验证过）。
- 预览样式额外单独输出一份 `markdown.css`，供只借用预览排版、外壳自己实现的使用方。

### 修复

- 首版，无历史问题。

### 内部

- 验收全部可一条命令跑完：`npm run verify`（类型 → 单测 → 纯函数 → SSR → 构建 → 消费者视角 → 发布校验 → demo 构建）。
- 构建收尾断言 4 项：四个产物存在非空、第三方库未被内联、预览样式确实进了 `style.css`。
- 发布前校验 7 项：版本与 CHANGELOG 一致、`exports` 目标存在、`files` 覆盖产物、
  依赖无本地路径、外部依赖已声明、README 非空、README 配图为绝对地址且版本号与源码一致。

## 已知边界

- `registerLocale` 是模块级注册表，SSR 场景下多请求共享同一份语言数据，
  应在应用启动时统一注册，不要按请求注册。
- 表格仅支持插入 Markdown 源码，无可视化编辑。
- 撤销栈基于文本快照，超大文档（十万字以上）连续输入时内存占用随步数线性增长。
