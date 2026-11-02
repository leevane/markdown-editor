// 文件：packages/markdown-editor/src/core/markdown.ts
// Markdown 的「编辑 + 渲染」核心：一个安全的 render 封装 + 一组纯函数工具。
// 全部是纯函数 / 无副作用的模块级状态，既能被组件调用，也能被 s78-check.mjs 直接断言。
// 依赖的导入：Marked 来自 'marked'；DOMPurify 来自 'dompurify'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'

/** 纯函数类命令的统一返回：新文本 + 建议光标位置（组件直接套用） */
export interface EditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** 工具栏激活态：光标处「已经是什么格式」，供按钮点亮与标题下拉回显 */
export interface EditorActiveState {
  bold: boolean
  italic: boolean
  strike: boolean
  inlineCode: boolean
  quote: boolean
  ul: boolean
  ol: boolean
  task: boolean
  /** '0' 表示正文，'1'~'6' 对应标题层级 */
  heading: string
}

/**
 * 渲染选项，透传给 renderMarkdown；对外以 MarkdownRenderOptions 的名字转出（见 types.ts）。
 * 对象要保持引用稳定（本模块按引用缓存 marked 实例），别在模板里现建字面量。
 */
export interface RenderOptions {
  /** marked 扩展数组（mermaid / 脚注 / @提及 等） */
  extensions?: unknown[]
  /** marked renderer 覆盖，如自定义 heading / link 的输出 */
  renderer?: Record<string, unknown>
  /** 其他 marked 选项，覆盖 gfm / breaks 等基座配置 */
  markedOptions?: Record<string, unknown>
  /** 设 false 关闭 DOMPurify 净化，仅调试用；线上务必留默认 true */
  sanitize?: boolean
  /** 标题 id 前缀：同页面多个编辑器预览同一文档时避免重复 id */
  idPrefix?: string
}

/** 目录项：level 是 1~6，id 与渲染出的标题 id 同一套算法 */
export interface TocItem {
  level: number
  text: string
  id: string
}

// 私有实例：不用 marked.setOptions 改全局配置。
// 复用这份代码的宿主项目多半自己也在用 marked，动全局单例会互相污染（选项被覆盖、
// 扩展被串味）；这里 new 一个只属于本模块的实例，gfm 管表格/删除线/任务列表，
// breaks 让单换行也换行（贴近评论、帮助文档的常见预期）。
const BASE_MARKED_OPTIONS = { gfm: true, breaks: true }
const md = new Marked(BASE_MARKED_OPTIONS)

// 带扩展的渲染：同一个 options 对象（引用相同）只建一次实例。
// 组件侧把 props.renderOptions 原样传进来就能一直命中缓存；
// 若每次现写对象字面量，会退化成「每次渲染都重建实例」，扩展多时明显变慢。
let cachedOptions: RenderOptions | null = null
let cachedMarked = md
function resolveMarked(opts: RenderOptions = {}) {
  const { extensions, renderer, markedOptions } = opts
  if (!extensions && !renderer && !markedOptions) return md
  if (opts === cachedOptions) return cachedMarked
  // marked 的选项类型比这里允许的多得多，宿主传进来的本来就是「够用即可」的松散对象
  const instance = new Marked({ ...BASE_MARKED_OPTIONS, ...markedOptions } as ConstructorParameters<typeof Marked>[0])
  if (renderer) instance.use({ renderer } as Parameters<typeof instance.use>[0])
  if (extensions) instance.use({ extensions } as Parameters<typeof instance.use>[0])
  cachedOptions = opts
  cachedMarked = instance
  return instance
}

// DOMPurify 白名单配置（导出便于宿主按需改写）。
// 相对默认配置收紧三处：
//   1. USE_PROFILES: { html: true } —— 只放行 HTML 档，SVG / MathML 整块关掉，
//      少一类 <animate onbegin> 之类的动画事件面；
//   2. FORBID_TAGS 补 form / input / button —— 默认白名单是放行这三兄弟的，
//      等于允许用户在评论里嵌一张指向别处的钓鱼表单；
//   3. 行内 style 属性必须留着：颜色 / 字号 / 背景色就是靠它实现的。
export const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button', 'select', 'textarea', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
}

// 当前环境能不能跑净化（浏览器 / 注入了 jsdom 的测试环境为 true，纯 node SSR 为 false）
export function canSanitize(): boolean {
  return typeof window !== 'undefined' && !!window.document
}

// DOMPurify 的实例获取：浏览器里默认导出已绑定 window，直接可用；
// node（测试 / SSR）里默认导出是工厂函数，需要注入 jsdom 的 window。
// 调用方（s78-check.mjs / s78-ssr.mjs）已在加载前注入 globalThis.window。
let hookReady = false
function getPurify() {
  const purify = DOMPurify as typeof DOMPurify & ((w: Window) => typeof DOMPurify)
  if (typeof window !== 'undefined' && window.document && typeof purify.sanitize === 'function') {
    if (!hookReady) {
      // 所有 _blank 链接补 rel，避免 opener 钓鱼
      purify.addHook('afterSanitizeAttributes', (node) => {
        const el = node as Element
        if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
          el.setAttribute('rel', 'noopener noreferrer')
        }
      })
      hookReady = true
    }
    return purify
  }
  if (typeof window !== 'undefined' && window.document) {
    return purify(window)
  }
  throw new Error('[markdown-editor] 需要 DOM 环境：浏览器自带，node 测试请先注入 jsdom window')
}

/**
 * 把 Markdown 字符串渲染成「已净化」的 HTML 字符串。
 * 两步：marked 解析 → DOMPurify 净化（剥离 script / onerror / 危险属性）。
 *
 * `idPrefix` 存在的理由：同页面放两个编辑器预览同一篇文档时，标题 id 会重复——
 * 重复 id 会让锚点跳到第一个，也会让 a11y 的「同一 id 多处使用」校验报错。
 */
export function renderMarkdown(src: string, opts: RenderOptions = {}): string {
  const text = typeof src === 'string' ? src : ''
  const instance = resolveMarked(opts)
  const rawHtml = addHeadingIds(instance.parse(text) as string, opts.idPrefix)
  if (opts.sanitize === false) return rawHtml
  const purify = getPurify()
  return purify.sanitize(rawHtml, { ...SANITIZE_CONFIG })
}

/**
 * 统计字数：中文按字计、英文单词 / 数字按词计，并剔除代码块与行内代码噪声。
 */
export function countWords(mdText: string): number {
  const text = (mdText || '')
    .replace(/```[\s\S]*?```/g, ' ') // 围栏代码块
    .replace(/`[^`]*`/g, ' ') // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/[#>*_~`]/g, ' ') // 常见 md 符号
    .replace(/\s+/g, ' ')
  const cjk = (text.match(/[一-龥]/g) || []).length
  const en = (text.match(/[A-Za-z0-9]+/g) || []).length
  return cjk + en
}

/**
 * 从 Markdown 抽取标题目录（跳过代码块内的 #）。
 * id 与 renderMarkdown 渲染出的标题 id 同一套算法，点击目录可直接锚点跳转。
 * `idPrefix` 必须与 renderMarkdown 传的一致，否则目录跳不到。
 */
export function buildToc(mdText: string, opts: { idPrefix?: string } = {}): TocItem[] {
  const prefix = opts.idPrefix || ''
  const lines = (mdText || '').split('\n')
  const toc: TocItem[] = []
  const used = new Map<string, number>()
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = line.match(/^(#{1,6})\s+(.*)$/)
    if (m) {
      const level = m[1].length
      const text = m[2].trim()
      toc.push({ level, text, id: prefix + nextId(slugify(text) || 'section', used) })
    }
  }
  return toc
}

function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 同名标题自动去重：标题 / 标题-1 / 标题-2，和目录侧同一份逻辑
function nextId(base: string, used: Map<string, number>): string {
  const n = used.get(base) || 0
  used.set(base, n + 1)
  return n ? `${base}-${n}` : base
}

// 给渲染出来的 h1-h6 补 id（marked 默认不加），目录才算真正能锚点跳转。
// 放在净化之前做，id 本身在 DOMPurify 的 HTML 白名单里，不会被剥掉。
function addHeadingIds(html: string, prefix = ''): string {
  const used = new Map<string, number>()
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_whole, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const id = prefix + nextId(slugify(text) || 'section', used)
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

/**
 * 工具栏：在选区两侧包裹标记（加粗 / 斜体 / 行内代码等）。
 * 两侧已经是同一个标记时反向操作——再点一次等于取消，避免出现 ****bold****。
 */
export function surroundSelection(
  value: string, selStart: number, selEnd: number, marker: string, placeholder = '',
): EditResult {
  const before = value.slice(0, selStart)
  const selected = value.slice(selStart, selEnd)
  const after = value.slice(selEnd)

  // 选区两侧已有标记：剥掉
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const b = before.slice(0, -marker.length)
    const a = after.slice(marker.length)
    return { value: b + selected + a, selectionStart: b.length, selectionEnd: b.length + selected.length }
  }
  // 选区自己就带着标记（整段 **bold** 被选中）：剥掉
  if (selected.length > marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(marker.length, -marker.length)
    const next = before + inner + after
    return { value: next, selectionStart: before.length, selectionEnd: before.length + inner.length }
  }

  const text = selected || placeholder
  const next = before + marker + text + marker + after
  const newStart = before.length + marker.length
  return { value: next, selectionStart: newStart, selectionEnd: newStart + text.length }
}

function escapeRe(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 工具栏：在「当前行」行首加前缀（标题 / 引用 / 列表 / 任务）。
 * 该行已有同类前缀时反向操作（再点一次取消）；ol 这种前缀会变的，
 * 用第 4 个参数传正则匹配（如 /^\d+[.)]\s+/）。
 */
export function prefixLine(
  value: string, selStart: number, prefix: string, pattern?: RegExp,
): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const lineEndRaw = value.indexOf('\n', selStart)
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
  const line = value.slice(lineStart, lineEnd)
  const re = pattern || new RegExp('^' + escapeRe(prefix))
  const hit = line.match(re)

  if (hit) {
    const next = value.slice(0, lineStart) + line.slice(hit[0].length) + value.slice(lineEnd)
    const caret = Math.max(lineStart, selStart - hit[0].length)
    return { value: next, selectionStart: caret, selectionEnd: caret }
  }

  const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  const caret = selStart + prefix.length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}

/**
 * 工具栏：插入一行独立内容（分割线等）。
 * 关键是与相邻行之间留空行——直接把 --- 塞在段落后一行会让上一行变成
 * setext 标题（"标题行\n---" 渲染成 <h2>标题行</h2>），不是分割线。
 */
export function insertLine(value: string, selStart: number, text: string): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const before = value.slice(0, lineStart)
  const after = value.slice(lineStart)
  const lead = before === '' || before.endsWith('\n\n') ? '' : '\n'
  const tail = after === '' ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const next = before + lead + text + tail + after
  const caret = before.length + lead.length + text.length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}

/**
 * 工具栏：插入一整块（表格 / 代码块等），前后各留一个空行。
 * 表格和正文贴在一起时 marked 不会按表格解析，空行是硬要求。
 */
export function insertBlock(value: string, selStart: number, block: string): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const before = value.slice(0, lineStart)
  const after = value.slice(lineStart)
  const lead = before === '' || before.endsWith('\n\n') ? '' : '\n'
  const tail = after === '' ? '' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const next = before + lead + block + tail + after
  const caret = before.length + lead.length + block.length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}

/**
 * 工具栏：设置当前行的标题层级（清掉已有的 # 再写入正确数量）。
 * @param level 1~6；传 0 表示「转回正文」（去掉标题前缀）
 */
export function setHeading(value: string, selStart: number, level: number): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const lineEnd = value.indexOf('\n', selStart)
  const end = lineEnd === -1 ? value.length : lineEnd
  const line = value.slice(lineStart, end)
  const content = line.replace(/^#{1,6}\s*/, '')
  const prefix = level > 0 ? '#'.repeat(Math.min(level, 6)) + ' ' : ''
  const next = value.slice(0, lineStart) + prefix + content + value.slice(end)
  const caret = lineStart + prefix.length + content.length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}

/**
 * 工具栏：用一对开闭标签包裹选区（颜色 / 字号 / 背景色等 HTML 行内样式）。
 * 与 surroundSelection 的区别：左右标记可以不同（如 <span ...> 与 </span>）；
 * 同样的开闭标签已经包着选区时反向剥掉，行为与加粗一致。
 */
export function wrapWithTags(
  value: string, selStart: number, selEnd: number,
  openTag: string, closeTag: string, placeholder = '文字',
): EditResult {
  const before = value.slice(0, selStart)
  const selected = value.slice(selStart, selEnd)
  const after = value.slice(selEnd)

  if (before.endsWith(openTag) && after.startsWith(closeTag) && selected) {
    const b = before.slice(0, -openTag.length)
    const a = after.slice(closeTag.length)
    return { value: b + selected + a, selectionStart: b.length, selectionEnd: b.length + selected.length }
  }

  const text = selected || placeholder
  const next = before + openTag + text + closeTag + after
  const newStart = before.length + openTag.length
  return { value: next, selectionStart: newStart, selectionEnd: newStart + text.length }
}

/**
 * 回车自动续列表（引用 / 无序 / 有序 / 任务）。
 * 返回 null 表示「这次回车不归我管」，调用方直接把默认行为放过去。
 *
 * 两条规则：
 *   1. 光标必须在行尾——在列表项中间回车是「拆行」，不该复制前缀；
 *   2. 空列表项（只有前缀没有内容）回车表示结束列表，去掉前缀留在本行，
 *      否则用户永远退不出列表，只能手动删。
 */
export function continueList(value: string, caret: number): EditResult | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1
  const lineEndRaw = value.indexOf('\n', caret)
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
  if (caret !== lineEnd) return null
  const line = value.slice(lineStart, lineEnd)

  // 引用：空引用行回车退出引用
  const quote = line.match(/^(\s*)(>\s?)/)
  if (quote) {
    const prefix = quote[1] + quote[2]
    if (line.length === prefix.length) {
      return { value: value.slice(0, lineStart) + quote[1] + value.slice(caret),
        selectionStart: lineStart + quote[1].length, selectionEnd: lineStart + quote[1].length }
    }
    const insert = '\n' + prefix
    const pos = caret + insert.length
    return { value: value.slice(0, caret) + insert + value.slice(caret), selectionStart: pos, selectionEnd: pos }
  }

  // 列表：["- ", "1. ", "- [ ] "] 这类前缀，任务列表的 [x] 续成 [ ]（新的一条待办）
  const m = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/)
  if (!m) return null
  const [all, indent, marker, space, task] = m
  if (line.length === all.length) {
    return { value: value.slice(0, lineStart) + value.slice(caret),
      selectionStart: lineStart, selectionEnd: lineStart }
  }
  const num = marker.match(/^(\d+)([.)])$/)
  const nextMarker = num ? `${Number(num[1]) + 1}${num[2]}` : marker
  const prefix = indent + nextMarker + space + (task ? '[ ] ' : '')
  const insert = '\n' + prefix
  const pos = caret + insert.length
  return { value: value.slice(0, caret) + insert + value.slice(caret), selectionStart: pos, selectionEnd: pos }
}

/**
 * Tab / Shift+Tab：缩进或反缩进。
 * 有选区时整块按行缩进（每行加 / 去一个缩进单位）；无选区时只动光标位置。
 * 组件里 Tab 会 preventDefault，否则焦点直接跳出编辑区——这是编辑器最容易漏的一条。
 * @param outdent true 表示 Shift+Tab
 * @param unit 缩进单位，默认两个空格（Markdown 里比 Tab 稳）
 */
export function indentSelection(
  value: string, selStart: number, selEnd: number, outdent = false, unit = '  ',
): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1

  // 无选区：在光标处插一个单位，或吃掉光标前最多一个单位的空白
  if (selStart === selEnd) {
    if (!outdent) {
      const next = value.slice(0, selStart) + unit + value.slice(selStart)
      const pos = selStart + unit.length
      return { value: next, selectionStart: pos, selectionEnd: pos }
    }
    const head = value.slice(lineStart, selStart)
    const m = head.match(/( {1,2}|\t)$/)
    if (!m) return { value, selectionStart: selStart, selectionEnd: selEnd }
    const next = value.slice(0, selStart - m[0].length) + value.slice(selStart)
    const pos = selStart - m[0].length
    return { value: next, selectionStart: pos, selectionEnd: pos }
  }

  const lineEndRaw = value.indexOf('\n', selEnd)
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  let firstDelta = 0
  const replaced = lines.map((line, i) => {
    if (!outdent) {
      firstDelta = i === 0 ? unit.length : firstDelta
      return unit + line
    }
    const m = line.match(/^( {1,2}|\t)/)
    const cut = m ? m[0].length : 0
    if (i === 0) firstDelta = -cut
    return line.slice(cut)
  }).join('\n')

  const next = value.slice(0, lineStart) + replaced + value.slice(lineEnd)
  const total = replaced.length - block.length
  return {
    value: next,
    selectionStart: Math.max(lineStart, selStart + firstDelta),
    selectionEnd: Math.max(lineStart, selEnd + total),
  }
}

/**
 * 当前行有没有实际文字（去掉行内空白后非空）。
 * 工具栏补占位符前必须问一句：空行才补，「光标在正文中间」绝不能把占位符劈进去。
 */
export function lineHasText(value: string, pos: number): boolean {
  const start = value.lastIndexOf('\n', pos - 1) + 1
  const endRaw = value.indexOf('\n', pos)
  const end = endRaw === -1 ? value.length : endRaw
  return value.slice(start, end).trim() !== ''
}

/** 光标是否处在某个行内标记内部：成对标记在「本行光标前」出现奇数次 */
function insideInline(value: string, selStart: number, selEnd: number, marker: string): boolean {
  const before = value.slice(0, selStart)
  const after = value.slice(selEnd)
  // 选区两侧正好是标记，或选区自己就带着标记
  if (before.endsWith(marker) && after.startsWith(marker)) return true
  if (selStart !== selEnd) {
    const sel = value.slice(selStart, selEnd)
    if (sel.length > marker.length * 2 && sel.startsWith(marker) && sel.endsWith(marker)) return true
  }
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  return (value.slice(lineStart, selStart).split(marker).length - 1) % 2 === 1
}

// 斜体单独判断：先把成对的 ** 摘掉，再数单个 *，否则加粗会被误判成斜体
function insideItalic(value: string, selStart: number): boolean {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const seg = value.slice(lineStart, selStart).replace(/\*\*/g, '')
  return (seg.split('*').length - 1) % 2 === 1
}

/**
 * 从「文本 + 光标位置」反推当前格式，供工具栏点亮与标题下拉回显。
 * 抽成纯函数而不是留在组件里，是为了能直接断言——这段逻辑错一位，
 * 用户就会看到 B 按钮明明在粗体里却不亮。
 */
export function detectActive(value: string, selStart: number, selEnd: number): EditorActiveState {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1
  const lineEndRaw = value.indexOf('\n', selStart)
  const line = value.slice(lineStart, lineEndRaw === -1 ? value.length : lineEndRaw)
  const h = line.match(/^(#{1,6})\s/)
  const task = /^[-*+]\s+\[[ xX]\]\s+/.test(line)
  const bold = insideInline(value, selStart, selEnd, '**')
  return {
    heading: h ? String(h[1].length) : '0',
    quote: /^>\s?/.test(line),
    task,
    ul: /^[-*+]\s+/.test(line) && !task,
    ol: /^\d+[.)]\s+/.test(line),
    inlineCode: insideInline(value, selStart, selEnd, '`'),
    strike: insideInline(value, selStart, selEnd, '~~'),
    bold,
    italic: !bold && insideItalic(value, selStart),
  }
}
