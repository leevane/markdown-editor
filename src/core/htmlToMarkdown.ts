// 文件：packages/markdown-editor/src/core/htmlToMarkdown.ts
// 剪贴板 HTML → Markdown：从 Word / 网页 / 飞书 / 语雀 里复制一段内容粘进编辑器，
// 原生 textarea 只会拿到「纯文本」，标题、列表、表格、链接全丢。这里用 turndown 还原。
//
// 两个设计约束：
//   1. turndown 是**动态加载**的——没人粘贴就不下载，Vite 会把它切成独立 chunk，
//      不拖慢首屏；
//   2. 转换失败（没装 turndown / 运行时报错）时返回 null，调用方退回浏览器默认粘贴，
//      绝不把用户剪贴板里的内容弄丢。

/** turndown 实例的最小结构（只用到我们真正调的那两个方法） */
interface TurndownLike {
  use: (plugin: unknown) => TurndownLike
  addRule: (key: string, rule: Record<string, unknown>) => TurndownLike
  turndown: (html: string) => string
}

let servicePromise: Promise<TurndownLike> | null = null

/**
 * 懒加载并配置 turndown 实例（同一份实例复用，配置只做一次）。
 * 没安装 turndown 时 reject，由调用方兜底。
 */
export function loadTurndown(): Promise<TurndownLike> {
  if (servicePromise) return servicePromise
  servicePromise = (async () => {
    const [{ default: TurndownService }, gfmMod] = await Promise.all([
      import('turndown'),
      // gfm 插件不是硬依赖：装了就支持表格 / 删除线 / 任务列表，没装也能跑
      import('turndown-plugin-gfm').catch(() => null),
    ])
    const svc = new TurndownService({
      headingStyle: 'atx', // # 标题，不用 === 下划线
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced', // ``` 围栏，不用四空格缩进
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    })
    if (gfmMod?.gfm) svc.use(gfmMod.gfm)

    // Word / 网页的 <br> 在表格单元格里很常见，转成空格比转成硬换行更贴近原意
    svc.addRule('cellBreak', {
      filter: (node: HTMLElement) => node.nodeName === 'BR' && !!node.closest?.('td,th'),
      replacement: () => ' ',
    })
    // 图片统一成 Markdown 语法。turndown 默认也会转，这里显式写是为了两件事：
    // 丢掉 data: URI（粘进正文只会撑爆文档）与 alt 里会让语法错位的方括号
    svc.addRule('image', {
      filter: 'img',
      replacement: (_content: string, node: HTMLElement) => {
        const src = node.getAttribute('src') || ''
        if (!src || src.startsWith('data:')) return '' // data URI 粘进正文只会撑爆文档
        const alt = (node.getAttribute('alt') || '').replace(/[[\]]/g, '')
        return `![${alt}](${src})`
      },
    })
    return svc as unknown as TurndownLike
  })().catch((err) => {
    servicePromise = null // 失败不缓存，下次粘贴还能重试（比如依赖是后装的）
    throw err
  })
  return servicePromise
}

/**
 * 判断剪贴板 HTML 值不值得走转换。
 * 只含纯文字（或只有一层 <span>）时没必要——直接用 text/plain 更快、也更不容易走样。
 */
export function looksLikeRichHtml(html: string): boolean {
  if (typeof html !== 'string' || !html) return false
  // 有明显的块级 / 行内语义标签才算「富文本」；`<span>abc</span>` 这种不算
  return /<(p|div|br|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|blockquote|pre|strong|b|em|i|a|img)\b/i.test(html)
}

/**
 * HTML → Markdown。失败返回 null（调用方退回默认粘贴）。
 */
export async function htmlToMarkdown(html: string): Promise<string | null> {
  try {
    const svc = await loadTurndown()
    const mdText = svc.turndown(html || '')
    // 压掉连续三个以上空行：从网页复制时 section 之间常有大量空 div
    return mdText.replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return null
  }
}

/**
 * 把一段 Markdown 贴进 value 的 [start, end) 区间，返回新值与光标位置。
 * 多行内容贴进句子中间时，前后补空行——否则标题 / 列表会和原来的段落粘成一行，
 * 渲染结果直接变形。
 */
export function insertMarkdownAt(
  value: string, start: number, end: number, text: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const src = typeof value === 'string' ? value : ''
  const s = Math.max(0, Math.min(start, src.length))
  const e = Math.max(s, Math.min(end, src.length))
  const before = src.slice(0, s)
  const after = src.slice(e)
  const multiline = /\n/.test(text)

  let lead = ''
  let tail = ''
  if (multiline) {
    if (before && !before.endsWith('\n')) lead = '\n\n'
    if (after && !after.startsWith('\n')) tail = '\n\n'
  }
  const next = before + lead + text + tail + after
  const caret = (before + lead + text).length
  return { value: next, selectionStart: caret, selectionEnd: caret }
}
