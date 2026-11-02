// 文件：packages/markdown-editor/src/composables/useEditorCommands.ts
// 工具栏动作层：每个命令做三件事——拿当前值和选区 → 调 core/markdown.ts 的纯函数算新值 →
// 交给组件的 commit 统一落盘（记历史 + 写 DOM + emit + 还原光标）。
//
// 抽出来的关键动机：这些函数原先都直接读 ta.value / props.modelValue / commit()，
// 跟组件内部状态搅在一起，既没法测也不能复用。现在它们只依赖一个三方法的上下文，
// 「怎么算」全在纯函数里，「怎么落」留给组件。
import {
  setHeading, surroundSelection, prefixLine, insertLine, insertBlock,
  wrapWithTags, lineHasText,
} from '../core/markdown'

/** 命令层需要组件提供的三件事；除此之外它不碰任何组件状态 */
export interface CommandContext {
  /** 当前 Markdown 源文 */
  getValue: () => string
  /** textarea 选区；取不到 DOM 时返回 null（命令直接放弃） */
  getSelection: () => { start: number; end: number } | null
  /** 落盘：写历史、写 DOM、emit、还原光标 */
  commit: (value: string, start: number, end: number) => void
}

/** 链接 / 图片插入后光标停在这里，方便直接粘贴地址 */
const URL_PLACEHOLDER = 'https://'

/** 颜色 / 字号 / 背景色 → 包裹用的开标签 */
const SPAN_OPENERS: Record<string, (v: string) => string> = {
  color: (v) => `<span style="color:${v}">`,
  bg: (v) => `<span style="background-color:${v}">`,
  size: (v) => `<span style="font-size:${v}">`,
}

export function useEditorCommands(ctx: CommandContext) {
  /** 设置当前行的标题层级，0 = 转回正文 */
  function heading(level: number) {
    const sel = ctx.getSelection()
    if (!sel) return
    const r = setHeading(ctx.getValue(), sel.start, level)
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  /** 选区两侧包标记（加粗 / 斜体 / 删除线 / 行内代码），再点一次取消 */
  function wrap(marker: string, placeholder: string) {
    const sel = ctx.getSelection()
    if (!sel) return
    const r = surroundSelection(ctx.getValue(), sel.start, sel.end, marker, placeholder)
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  /**
   * 行首前缀（引用 / 列表 / 任务）。
   * 有选区、或这行本来就有文字：只加 / 去前缀，绝不把占位符劈进正文中间；
   * 只有整行是空的时候才补占位符，用户一按就能直接敲内容。
   */
  function line(prefix: string, placeholder: string, pattern: RegExp) {
    const sel = ctx.getSelection()
    if (!sel) return
    const value = ctx.getValue()
    const r = prefixLine(value, sel.start, prefix, pattern)
    if (sel.end !== sel.start || lineHasText(value, sel.start)) {
      ctx.commit(r.value, r.selectionStart, r.selectionEnd)
      return
    }
    const next = r.value.slice(0, r.selectionStart) + placeholder + r.value.slice(r.selectionStart)
    ctx.commit(next, r.selectionStart, r.selectionStart + placeholder.length)
  }

  /** 分割线：前后自动留空行，否则 --- 会把上一行变成 setext 标题 */
  function hr() {
    const sel = ctx.getSelection()
    if (!sel) return
    const r = insertLine(ctx.getValue(), sel.start, '---')
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  /**
   * 表格：前后留空行，否则 marked 不按表格解析。
   * 列名与单元格文字由调用方按语言传入——命令层不留任何界面语言。
   */
  function table(column: (index: number) => string, cell: string) {
    const sel = ctx.getSelection()
    if (!sel) return
    const template = [
      `| ${column(1)} | ${column(2)} | ${column(3)} |`,
      '| --- | --- | --- |',
      `| ${cell} | ${cell} | ${cell} |`,
      `| ${cell} | ${cell} | ${cell} |`,
    ].join('\n')
    const r = insertBlock(ctx.getValue(), sel.start, template)
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  function codeBlock(comment: string) {
    const sel = ctx.getSelection()
    if (!sel) return
    const template = ['```js', comment, 'console.log("hello")', '```'].join('\n')
    const r = insertBlock(ctx.getValue(), sel.start, template)
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  /** 链接 / 图片：插入模板并把光标停在地址上，接着粘贴就能用 */
  function decorated(before: string, after: string, fallback: string) {
    const sel = ctx.getSelection()
    if (!sel) return
    const value = ctx.getValue()
    const label = value.slice(sel.start, sel.end) || fallback
    const head = value.slice(0, sel.start)
    const tail = value.slice(sel.end)
    const insert = `${before}${label}${after}(${URL_PLACEHOLDER})`
    const next = head + insert + tail
    const urlStart = head.length + before.length + label.length + after.length + 1
    ctx.commit(next, urlStart, urlStart + URL_PLACEHOLDER.length)
  }

  function link(label: string) {
    decorated('[', ']', label)
  }

  function image(alt: string) {
    decorated('![', ']', alt)
  }

  /**
   * 颜色 / 字号 / 背景色：以受净化的 HTML 行内样式实现。
   * 渲染侧统一过 DOMPurify，所以这里只管拼标签，不必自己做转义。
   * placeholder 用于选区为空时的兜底文字（按语言传）。
   */
  function applyStyle(kind: 'color' | 'bg' | 'size', val: string, placeholder: string) {
    if (!val) return
    const sel = ctx.getSelection()
    if (!sel) return
    const open = SPAN_OPENERS[kind](val)
    const r = wrapWithTags(ctx.getValue(), sel.start, sel.end, open, '</span>', placeholder)
    ctx.commit(r.value, r.selectionStart, r.selectionEnd)
  }

  return { heading, wrap, line, hr, table, codeBlock, link, image, applyStyle }
}
