// 文件：packages/markdown-editor/src/core/upload.ts
// 图片上传的「正文侧」纯函数：插占位、回填地址、失败清理。不碰网络，不碰 DOM，不依赖 vue。
//
// 为什么占位要写进正文，而不是只在状态栏转个圈：
// 上传是异步的，用户在这段时间里会继续打字。若只在完成后「插到当前光标」，
// 位置多半已经错了；占位符把位置钉在正文里，回填时按 token 找回来即可。
//
// token 只藏在伪地址里（uploading:u1）：浏览器不会去请求它，
// 回填成功就整段替换成真实图片语法；失败则整段删掉，不把坏图留在正文里。
import { insertBlock } from './markdown'
import type { EditResult } from './markdown'

/** 占位图的伪地址前缀，同时也是回填时的定位标记 */
export const UPLOAD_SRC_PREFIX = 'uploading:'

/** 占位图在正文里的区间（半开区间，end 不含） */
export interface PlaceholderRange {
  start: number
  end: number
}

/**
 * 文件名 → 默认 alt。
 * 去路径、去扩展名，方括号换成空格——alt 里出现 `]` 会提前结束 Markdown 的图片语法。
 */
export function defaultImageAlt(fileName?: string): string {
  if (!fileName) return ''
  const base = fileName.split(/[\\/]/).pop() || ''
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  return stem.replace(/[[\]]/g, ' ').trim()
}

/** 拼一张占位图：`![alt](uploading:token)` */
export function imagePlaceholder(alt: string, token: string): string {
  const safe = (alt || '').replace(/[[\]]/g, ' ').trim() || 'image'
  return `![${safe}](${UPLOAD_SRC_PREFIX}${token})`
}

/**
 * 清理图片地址。
 * 地址里有空白时必须转义，否则 Markdown 会把它当成「图片语法结束 + 一段文字」。
 * 括号交给 CommonMark 的配对规则处理，不做额外包装。
 */
export function normalizeImageUrl(url: string): string {
  const u = (url || '').trim()
  if (!u) return ''
  return /\s/.test(u) ? encodeURI(u) : u
}

/** 按 token 找回占位图；正文里已经没有它（用户删了 / 撤销了）就返回 null */
export function findImagePlaceholder(value: string, token: string): PlaceholderRange | null {
  const marker = `](${UPLOAD_SRC_PREFIX}${token})`
  const close = value.indexOf(marker)
  if (close === -1) return null
  const start = value.lastIndexOf('![', close)
  if (start === -1) return null
  return { start, end: close + marker.length }
}

/** 在光标处插入占位图，前后各留一个空行（与表格、代码块一致，图片是块级元素） */
export function insertImagePlaceholder(
  value: string,
  selStart: number,
  alt: string,
  token: string,
): EditResult {
  return insertBlock(value, selStart, imagePlaceholder(alt, token))
}

/** 上传成功：把占位整段换成真实图片；占位已消失或地址为空时返回 null */
export function replaceImagePlaceholder(
  value: string,
  token: string,
  url: string,
  alt: string,
): string | null {
  const range = findImagePlaceholder(value, token)
  if (!range) return null
  const target = normalizeImageUrl(url)
  if (!target) return null
  const safeAlt = (alt || '').replace(/[[\]]/g, ' ').trim()
  return value.slice(0, range.start) + `![${safeAlt}](${target})` + value.slice(range.end)
}

/**
 * 上传失败：删掉占位图，并把占位两侧的空行一起收掉。
 * 只删图片的话，块级插入留下的空行会变成正文里一个突兀的空段；
 * 收的只是接缝处的换行，不碰文档其他位置。
 */
export function removeImagePlaceholder(value: string, token: string): string | null {
  const range = findImagePlaceholder(value, token)
  if (!range) return null
  const before = value.slice(0, range.start)
  const after = value.slice(range.end)
  // 占位是块级插入的：前后都在行首行尾才按「整段」处理，行内的极端情况直接拼回去
  const atLineStart = before === '' || before.endsWith('\n')
  const atLineEnd = after === '' || after.startsWith('\n')
  if (!atLineStart || !atLineEnd) return before + after

  const left = before.replace(/\n+$/, '')
  const right = after.replace(/^\n+/, '')
  if (!left) return right
  if (!right) return left
  return `${left}\n\n${right}`
}
