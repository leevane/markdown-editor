// 文件：packages/markdown-editor/src/locales/index.ts
// 语言包入口：注册表 + 取包函数。一门语言一个文件（zh.ts / en.ts），
// 这里只做「语言码 → 语言包」的映射，本身不含任何文案。
//
// 使用方：<MarkdownEditor language="en" />，不需要知道内部有哪些字段。
// 加一门语言：在 locales/ 下新建 ja.ts 导出完整的 ResolvedTexts，
// 然后在下面 LOCALES 里加一行、SUPPORTED_LANGUAGES 加一个码即可。
// 业务侧临时加语言也可以直接 registerLocale('ja', JA_TEXTS)，不必改组件源码。
import type { ResolvedTexts } from '../types'
import { ZH_TEXTS } from './zh'
import { EN_TEXTS } from './en'

export { ZH_TEXTS, EN_TEXTS }

/** 语言注册表：键是小写的语言码，用 language prop 选 */
const LOCALES: Record<string, ResolvedTexts> = {
  zh: ZH_TEXTS,
  en: EN_TEXTS,
}

/** 取语言包：没注册过的语言码一律退回中文，不会渲染出空白文案 */
export function getLocale(code: string): ResolvedTexts {
  return LOCALES[code] || ZH_TEXTS
}

/**
 * 注册一门新语言（ja / ko / 繁体…），或覆盖内置语言。
 * 传的是完整语言包，少字段会在编译期报错——这是故意的，宁可写的时候报错，
 * 也别运行时冒出一句中文混在日文界面里。
 */
export function registerLocale(code: string, texts: ResolvedTexts): void {
  if (!code) return
  LOCALES[code.toLowerCase()] = texts
}

/** 内置语言列表（注册过的自定义语言不在里面） */
export const SUPPORTED_LANGUAGES = ['zh', 'en'] as const
