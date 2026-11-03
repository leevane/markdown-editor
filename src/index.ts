// 文件：packages/markdown-editor/src/index.ts
// 组件的唯一入口（barrel）。对外只暴露「一个组件 + 一组纯函数 + 全部类型」，
// 内部的 core / composables / toolbar / styles 怎么分，使用方不必知道。
//
//   import MarkdownEditor, { renderMarkdown, buildToc } from '@leevane/markdown-editor'
//   import type { MarkdownEditorInstance } from '@leevane/markdown-editor'
//
// 为什么不直接 import './MarkdownEditor.vue'：使用者只需要记住一个路径；
// 将来内部再拆文件、改名，也不会传导到业务代码。
export { default } from './MarkdownEditor.vue'
export { default as MarkdownEditor } from './MarkdownEditor.vue'

// 配置与常量：想在内置工具栏上增删，先 import 再改
export { DEFAULT_TOOLBAR, DEFAULT_TEXTS, MODES } from './config'

// 语言包：language="en" 就够用。内置语言一门一个文件放在 locales/（zh.ts / en.ts），
// 加日语 / 繁体：新建 locales/ja.ts 再 registerLocale('ja', JA_TEXTS) 即可
export { ZH_TEXTS, EN_TEXTS, registerLocale, getLocale, SUPPORTED_LANGUAGES } from './locales'

// 纯函数：渲染 / 净化 / 字数 / 目录 / 选区计算 / 续列表 / 缩进 / 激活态
// SANITIZE_CONFIG 一并导出：宿主想收紧或放宽白名单时，改它比改组件源码省事
export {
  renderMarkdown, countWords, buildToc, canSanitize, detectActive, SANITIZE_CONFIG,
  surroundSelection, prefixLine, insertLine, insertBlock, setHeading,
  wrapWithTags, continueList, indentSelection, lineHasText,
} from './core/markdown'

// 粘贴转换（turndown 在首次调用时动态加载）
export { htmlToMarkdown, looksLikeRichHtml, insertMarkdownAt } from './core/htmlToMarkdown'

// 图片占位：宿主自建上传 UI（自己的图库、批量拖拽）时，可以直接复用这套占位与回填，
// 免得自己拼 `![alt](url)` 时把文件名里的方括号、地址里的空格拼坏
export {
  imagePlaceholder, defaultImageAlt, findImagePlaceholder,
  insertImagePlaceholder, replaceImagePlaceholder, removeImagePlaceholder,
} from './core/upload'
export type { PlaceholderRange } from './core/upload'

// 快捷键：默认键位表 + 键位描述的解析 / 匹配 / 格式化。
// 宿主自定义工具栏按钮时，可以用 formatShortcut 拼出和内置提示同一种写法（(Ctrl+B)）
export { DEFAULT_SHORTCUTS, formatShortcut, parseShortcut, matchShortcut } from './core/shortcuts'

// 颜色：给了背景色该配白字还是黑字。
// 宿主自己画「实底 + 反白字」的按钮（自定义工具栏项）时，可以直接复用同一套判据
export { readableTextColor, contrastRatio, relativeLuminance, parseColor } from './core/color'
export type { RGB, ReadableTextOptions } from './core/color'

// 类型：给 ref 标注、或在自己的组合式函数里复用时用
export type {
  MarkdownEditorProps, MarkdownEditorInstance, MarkdownEditorMode,
  MarkdownEditorTexts, MarkdownEditorSnippets, MarkdownEditorTheme, MarkdownEditorLanguage,
  MarkdownEditorShortcut, MarkdownEditorShortcuts,
  MarkdownEditorUploadImage,
  MarkdownRenderOptions, ToolbarItem, ToolbarCustomTool, ToolbarToolKey, ToolbarTexts,
} from './types'
// RenderOptions 与上面的 MarkdownRenderOptions 是同一个类型：定义在 core（渲染函数的入参），
// types.ts 只是换了个对外的名字转出来
export type { EditResult, EditorActiveState, RenderOptions, TocItem } from './core/markdown'
