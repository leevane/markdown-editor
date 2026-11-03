// 文件：packages/markdown-editor/src/types.ts
// MarkdownEditor 的对外契约：props / 事件 / 暴露方法 / 工具栏项 / 渲染选项。
// 纯类型文件（只有 interface / type），编译产物为空，跟着目录拷走即可。
//
// 用法：
//   import type { MarkdownEditorInstance, MarkdownEditorTexts } from '@leevane/markdown-editor'
//   /** @type {import('vue').Ref<MarkdownEditorInstance | null>} */
//   const editorRef = ref(null)
import type { RenderOptions } from './core/markdown'

/** 三种显示状态：编辑 / 分屏 / 预览 */
export type MarkdownEditorMode = 'edit' | 'split' | 'preview'

/** 主题：跟随系统时用 auto */
export type MarkdownEditorTheme = 'light' | 'dark' | 'auto'

/**
 * 界面语言：内置 zh / en（语言包在 locales/zh.ts、locales/en.ts），
 * 注册过的自定义语言码也能传。
 * 写成 `(string & {})` 是为了既保留 'zh' | 'en' 的补全提示，又不把扩展语言挡在类型外。
 */
export type MarkdownEditorLanguage = 'zh' | 'en' | (string & {})

/** 工具栏自定义按钮：icon 是 24×24 的 SVG 内层标记（stroke 走 currentColor） */
export interface ToolbarCustomTool {
  /** 唯一 key，用于去重 */
  key?: string
  /** SVG 内层标记，如 '<path d="…"/>' */
  icon: string
  /** 悬浮提示 */
  title?: string
  onClick: () => void
}

/**
 * 工具栏配置项：
 * - 组名：history / heading / block / inline / style
 * - 单个工具 id：undo / redo / heading / quote / ul / ol / task / hr / table /
 *   bold / italic / strike / inlineCode / codeBlock / link / image / color / size / bg
 * - 'sep' 手动分隔线
 * - 自定义工具对象
 */
export type ToolbarItem = string | ToolbarCustomTool

/**
 * 工具栏内置工具的 id，与 toolbar/registry.ts 里的 builders 一一对应。
 * 单独抽成联合类型是为了让 texts.tools 的键有提示、拼错能报错。
 */
export type ToolbarToolKey =
  | 'undo' | 'redo'
  | 'heading' | 'size'
  | 'color' | 'bg'
  | 'quote' | 'ul' | 'ol' | 'task' | 'hr' | 'table'
  | 'bold' | 'italic' | 'strike' | 'inlineCode' | 'codeBlock' | 'link' | 'image'

/**
 * 工具栏文案覆盖：键是工具 id，值是按钮的悬浮提示，同时也是 aria-label。
 * 只传要改的键，其余走当前 language 对应的语言包，不会因为漏传某个键就变空白。
 *
 * 只写工具名，别把键位写进来（写「加粗」，不要写「加粗 (Ctrl+B)」）：
 * 后缀由组件按当前 shortcuts 配置现算，宿主改了键位、或把某个动作关掉，
 * 提示会跟着变；写死就会变成「提示说 Ctrl+B、按下去没反应」。
 */
export type ToolbarTexts = Partial<Record<ToolbarToolKey, string>>

/**
 * 插入到正文里的占位文字（不是界面文案）。
 * 界面翻了但这里没翻的话，英文站点一下「加粗」就会往正文里塞「**加粗文字**」——
 * 这类字只有点了按钮才看得见，比界面漏翻更难发现，所以单独成一组、同样走语言包。
 */
export interface MarkdownEditorSnippets {
  /** 给选区套颜色 / 字号而选区为空时的兜底文字，默认「文字」 */
  text?: string
  /** 引用块里的占位，默认「引用内容」 */
  quote?: string
  /** 无序 / 有序列表项的占位，默认「列表项」 */
  listItem?: string
  /** 任务列表项的占位，默认「待办事项」 */
  taskItem?: string
  bold?: string
  italic?: string
  strike?: string
  inlineCode?: string
  /** 链接文字，默认「链接文字」 */
  link?: string
  /** 图片 alt，默认「图片描述」 */
  image?: string
  /** 表头列名：传序号，中文拼「列1」、英文拼「Col 1」 */
  tableColumn?: (index: number) => string
  /** 表格单元格文字，默认「内容」 */
  tableCell?: string
  /** 代码块里的示例注释行，默认「// 代码」 */
  codeBlock?: string
}

/**
 * 逐句覆盖界面文案：优先级高于 language（texts > 语言包 > 中文默认）。
 * 整套换语言请用 language；这里只解决「我们公司把『字数』叫『字符数』」这类个别差异。
 */
export interface MarkdownEditorTexts {
  placeholder?: string
  sourceLabel?: string
  previewLabel?: string
  modeEdit?: string
  modeSplit?: string
  modePreview?: string
  wordsLabel?: string
  linesLabel?: string
  /** 状态栏光标位置，默认 `第 N 行 · 第 M 列` */
  cursor?: (line: number, col: number) => string
  /** 工具栏的 aria-label，默认「编辑工具栏」 */
  toolbarLabel?: string
  /** 显示模式切换那一组的 aria-label，默认「显示模式」 */
  viewModeLabel?: string
  /** 全屏按钮的悬浮提示与 aria-label（未全屏时），默认「全屏」 */
  fullscreenEnter?: string
  /** 全屏按钮的悬浮提示与 aria-label（已全屏时），默认「退出全屏」 */
  fullscreenExit?: string
  /** 状态栏里的上传提示，收到待上传张数，默认「正在上传 N」 */
  uploading?: (count: number) => string
  /** 工具栏每个按钮的悬浮提示 + aria-label，按工具 id 覆盖；不传就用语言包里那张表 */
  tools?: ToolbarTexts
  /** 标题下拉里的「正文」项（H1 / H2 这些不用翻） */
  headingParagraph?: string
  /** 字号下拉的占位项文案 */
  sizeLabel?: string
  /** 插入到正文的占位文字；只传想改的几个键 */
  snippets?: MarkdownEditorSnippets
}

/**
 * 文案的实际形态：语言包提供全部字段。
 * tools 与 snippets 是两张表，各自要求写全——缺一个键是编译期错误，不是运行时空白。
 */
export type ResolvedTexts = Required<Omit<MarkdownEditorTexts, 'tools' | 'snippets'>> & {
  tools: Record<ToolbarToolKey, string>
  snippets: Required<MarkdownEditorSnippets>
}

/**
 * 渲染选项，透传给 renderMarkdown。
 * 定义在 core/markdown.ts（渲染函数的入参在那里），这里只转出对外的名字，
 * 免得同一个结构写两遍、改一处忘一处。
 */
export type MarkdownRenderOptions = RenderOptions

/**
 * 一个键位描述：'mod+b' 表示 Ctrl+B（macOS 上是 ⌘+B），也可以写 'ctrl+alt+k'。
 * 传 false 表示这个动作不挂快捷键。
 */
export type MarkdownEditorShortcut = string | false

/**
 * 快捷键配置。默认 mod+b / mod+i / mod+k / mod+e（加粗 / 斜体 / 链接 / 行内代码）。
 *
 * - 不传：用默认四个
 * - 传对象：只覆盖写到的动作，没写的仍是默认（想彻底去掉某个动作就写 false）
 * - 传 false：全部关闭
 *
 * 修饰键要求「完全一致」：写了 'mod+b' 就只认 Ctrl+B / ⌘+B，
 * 按下 Ctrl+Shift+B 不会命中它，所以 mod+b 与 mod+shift+b 可以分给两个动作。
 * Ctrl+Z / Ctrl+Y 是编辑器基本行为（要同步历史栈），不在可配范围里。
 */
export type MarkdownEditorShortcuts = false | {
  bold?: MarkdownEditorShortcut
  italic?: MarkdownEditorShortcut
  link?: MarkdownEditorShortcut
  inlineCode?: MarkdownEditorShortcut
}

/**
 * 图片上传适配器：拿到 File，返回可访问的地址。
 * 也可以返回 `{ url, alt }` 一并指定替代文本（不指定就用文件名去掉扩展名）。
 * 抛错或返回空地址都按失败处理：占位会被删掉，并触发 `upload-error`。
 */
export type MarkdownEditorUploadImage = (
  file: File,
) => Promise<string | { url: string; alt?: string }>

export interface MarkdownEditorProps {
  /** Markdown 源文，配合 v-model */
  modelValue?: string
  /** 受控模式；不传则组件内部维护 */
  mode?: MarkdownEditorMode
  /** 分屏区高度，数字按 px */
  height?: string | number
  /** 编辑器宽度，数字按 px */
  width?: string | number
  /** 输入占位文案；传 '' 表示不要占位文案，不传 / null 用内置默认 */
  placeholder?: string | null
  /** 只读：隐藏插入类工具，保留显示模式切换 */
  readonly?: boolean
  showToolbar?: boolean
  showStatus?: boolean
  showMode?: boolean
  showLabels?: boolean
  /** 主题：light（默认）/ dark / auto（跟随系统 prefers-color-scheme） */
  theme?: MarkdownEditorTheme
  /**
   * 界面语言：'zh'（默认）/ 'en'，或 registerLocale 注册过的语言码。
   * 一句话就能整套换语言，不需要知道组件内部有哪些文案字段。
   */
  language?: MarkdownEditorLanguage
  /**
   * 品牌主色。传任意 CSS 颜色（`#2563eb` / `rgb(37 99 235)`），
   * 会替换内置的 sage 绿：工具栏激活态、模式切换的选中项、输入框聚焦边框、正文链接与引用块淡底。
   * 亮色 / 深色主题同时生效；激活态上的字色按对比度自动挑白或深色，
   * 所以换成浅色（黄、浅蓝）也不会出现「白字贴浅底」。
   * 不传则用内置绿。只想改个别颜色就在宿主 CSS 里覆盖 `--md-*` 变量。
   */
  accentColor?: string
  /** 标题 id 前缀：同页面多个编辑器预览同一文档时避免重复 id */
  idPrefix?: string
  /** 粘贴富文本时是否把剪贴板 HTML 转成 Markdown（默认 true） */
  pasteHtml?: boolean
  /** 预览渲染防抖毫秒数，默认 120；传 0 关闭（字数 / 行数始终实时） */
  renderDelay?: number
  /**
   * 字数上限：仅用于状态栏提示与超限标记，不截断输入。
   * 口径与状态栏「字数」一致（中文按字、英文按词，见 countWords）。
   * 0 / 负数 / 非有限数表示不限制。
   */
  maxLength?: number
  /** 是否显示全屏按钮，默认 true */
  showFullscreen?: boolean
  /**
   * 全屏状态。不传则由组件内部维护（点按钮即切换）；
   * 传入即受控，配合 `v-model:fullscreen` 使用。Esc 退出会触发 `update:fullscreen`。
   */
  fullscreen?: boolean
  /**
   * 撤销合并窗口（毫秒），默认 800。
   * 连续打字落在窗口内算一步撤销；传 0 表示每次改动单独一步（逐字撤销）。
   */
  undoMergeWindow?: number
  /** 快捷键：默认 mod+b/i/k/e；传 false 全关，传对象只覆盖写到的动作 */
  shortcuts?: MarkdownEditorShortcuts
  /**
   * 图片上传适配器。不传时组件只把文件通过 `paste-image` / `drop-image` 抛给宿主；
   * 传了则粘贴、拖入、点工具栏图片按钮三条入口都走它：先在光标处插占位，
   * 拿到地址后回填，失败则删掉占位并触发 `upload-error`。
   * 组件仍然不碰网络——地址怎么来、怎么鉴权、怎么压缩，全在宿主这一侧。
   */
  uploadImage?: MarkdownEditorUploadImage
  toolbar?: ToolbarItem[]
  texts?: MarkdownEditorTexts
  renderOptions?: MarkdownRenderOptions
}

/** 父组件通过 ref 调用的方法 */
export interface MarkdownEditorInstance {
  focus: () => void
  /** 当前预览 HTML（已净化） */
  getHtml: () => string
  /** 在光标处插入文本；只读态返回 false */
  insert: (text: string) => boolean
  /**
   * 打开系统的文件选择框，走 `uploadImage` 上传。
   * 宿主想在工具栏外面再放一个「插入图片」按钮时用它。
   * 未配置 `uploadImage`、只读、或不在浏览器环境时返回 false。
   */
  pickImage: () => boolean
  undo: () => void
  redo: () => void
  setMode: (mode: MarkdownEditorMode) => void
}

// 「编辑语义」类型（EditResult / EditorActiveState / RenderOptions）定义在 core/markdown.ts：
// 它们描述的是纯函数的输入输出，跟着函数走。
// 目录内的依赖是单向的：MarkdownEditor.vue → composables / toolbar → core；
// 本文件只从 core 取 RenderOptions 这一个类型（import type，编译后为空），
// core 不反向 import 任何本地文件，因此不存在环形依赖。
// 需要对外暴露时由 index.ts 转出去。
