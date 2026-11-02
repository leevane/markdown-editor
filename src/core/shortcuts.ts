// 文件：packages/markdown-editor/src/core/shortcuts.ts
// 快捷键匹配：把 'mod+shift+b' 这种描述翻译成对 KeyboardEvent 的判断。
// 纯逻辑，不 import vue、不碰 DOM（只读事件对象），所以能直接单测和 node 断言。
//
// 为什么不用字符串比较：KeyboardEvent 的 key 会随 Shift / 输入法 / 键盘布局变，
// 'B' 和 'b' 都得认；修饰键还要求「该按的按了、不该按的没按」——
// 否则 Ctrl+Shift+B 会被 Ctrl+B 抢走，宿主想把两个动作分开就没法分。
//
// mod 的含义沿用各编辑器的惯例：Windows / Linux 是 Ctrl，macOS 是 ⌘。
// 也接受 ctrl / meta / cmd / command 这类写法，写清楚平台差异时用得上。

/** 默认键位表。想加动作先在这里加一行，再在组件里接上对应命令 */
export const DEFAULT_SHORTCUTS = {
  bold: 'mod+b',
  italic: 'mod+i',
  link: 'mod+k',
  inlineCode: 'mod+e',
} as const

/** 内置动作名，与 DEFAULT_SHORTCUTS 的键一一对应 */
export type BuiltinShortcutAction = keyof typeof DEFAULT_SHORTCUTS

/** 动作名 → 键位；false / undefined 表示这个动作不挂快捷键 */
export type ShortcutMap = Record<string, string | false | undefined>

export interface ParsedShortcut {
  /** Ctrl 或 ⌘ */
  mod: boolean
  shift: boolean
  alt: boolean
  /** 主键，已转小写 */
  key: string
}

/**
 * 解析 'mod+shift+b'。
 * 非法（空串、只有修饰键、含未知修饰键）返回 null——调用方据此跳过，不抛错。
 * 单键（如 'b'）也不认：没有任何修饰键的字母键会干扰正常打字。
 */
export function parseShortcut(spec: string): ParsedShortcut | null {
  if (!spec || typeof spec !== 'string') return null
  const parts = spec.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const key = parts.pop() as string
  if (!key) return null

  const parsed: ParsedShortcut = { mod: false, shift: false, alt: false, key }
  for (const p of parts) {
    if (p === 'mod' || p === 'ctrl' || p === 'control' || p === 'meta' || p === 'cmd' || p === 'command') {
      parsed.mod = true
    } else if (p === 'shift') {
      parsed.shift = true
    } else if (p === 'alt' || p === 'option') {
      parsed.alt = true
    } else {
      return null
    }
  }
  return parsed
}

/**
 * 事件是否命中某个键位描述。
 * 修饰键按「完全一致」判断：没写 mod 就是「不许按 Ctrl / ⌘」，
 * 于是 mod+k 与 mod+shift+k 可以并存，各走各的动作。
 */
export function matchShortcut(e: KeyboardEvent, spec?: string | false): boolean {
  if (!spec) return false
  const p = parseShortcut(spec)
  if (!p) return false
  if (p.mod !== (e.ctrlKey || e.metaKey)) return false
  if (p.shift !== e.shiftKey) return false
  if (p.alt !== e.altKey) return false
  return e.key.toLowerCase() === p.key
}

/**
 * 键位描述 → 给人看的写法：'mod+shift+b' → 'Ctrl+Shift+B'。
 * 工具栏提示里的「(Ctrl+B)」就是它拼的——宿主把加粗改到 Alt+B，
 * 提示会自己变成「加粗 (Alt+B)」，不用另外改文案。
 *
 * 修饰键按 Ctrl/⌘ → Alt → Shift 的固定顺序输出（系统菜单的写法），
 * 所以 'shift+mod+b' 和 'mod+shift+b' 显示一致。解析不了就返回空串，
 * 调用方据此不加后缀，绝不让提示出现「加粗 ()」这种半截东西。
 */
export function formatShortcut(spec?: string | false): string {
  const s = typeof spec === 'string' ? spec : ''
  const p = parseShortcut(s)
  if (!p) return ''

  const mods: string[] = []
  // 写 meta / cmd 的是明确要 ⌘，写 mod 的按「当前平台的主修饰键」理解，提示里统一写作 Ctrl
  if (p.mod) mods.push(/\b(meta|cmd|command)\b/.test(s.toLowerCase()) ? '⌘' : 'Ctrl')
  if (p.alt) mods.push('Alt')
  if (p.shift) mods.push('Shift')
  return [...mods, p.key.length === 1 ? p.key.toUpperCase() : p.key].join('+')
}

/**
 * 在动作表里找第一个命中的动作名，没有就返回 null。
 * 值为 false / undefined 的条目直接跳过——那正是「这个动作不要快捷键」的表达方式。
 */
export function hitShortcut(e: KeyboardEvent, map: ShortcutMap): string | null {
  for (const [action, spec] of Object.entries(map)) {
    if (spec && matchShortcut(e, spec)) return action
  }
  return null
}
