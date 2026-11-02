// 文件：packages/markdown-editor/src/config.ts
// 组件的「可配置常量」：默认工具栏、显示模式、下拉选项、行前缀正则。
// 界面文案不在这里——它们按语言分文件放在 locales/（zh.ts / en.ts），换语言靠 language prop，
// 这份文件只管「跟语言无关的结构性配置」。
import type { MarkdownEditorMode, ToolbarItem } from './types'
import { ZH_TEXTS } from './locales'

/** 工具栏默认配置：组名或单个工具 id 组成的数组 */
export const DEFAULT_TOOLBAR: ToolbarItem[] = ['history', 'heading', 'block', 'inline', 'style']

/**
 * 默认文案（中文语言包的别名）。
 * 想整套换语言用 language="en"；只想改一两句才用 texts。
 */
export const DEFAULT_TEXTS = ZH_TEXTS

/** 三种显示状态，及各自的文案键 */
export const MODES: { value: MarkdownEditorMode; label: 'modeEdit' | 'modeSplit' | 'modePreview' }[] = [
  { value: 'edit', label: 'modeEdit' },
  { value: 'split', label: 'modeSplit' },
  { value: 'preview', label: 'modePreview' },
]

/** 合法的 mode 值：传错一个字符串不该让两个面板同时显示、single 类也失效 */
export const VALID_MODES: MarkdownEditorMode[] = ['edit', 'split', 'preview']

/**
 * 标题层级下拉：'0' 表示正文（去掉 # 前缀）。
 * 做成函数而不是常量，是因为「正文」这个词要跟着 texts.headingParagraph 走。
 */
export function headingOptions(paragraph = DEFAULT_TEXTS.headingParagraph) {
  return [
    { value: '0', label: paragraph },
    { value: '1', label: 'H1' },
    { value: '2', label: 'H2' },
    { value: '3', label: 'H3' },
  ]
}

/**
 * 字号下拉：第一项是占位项，下拉是「动作」，选完归位到这里。
 * 数字本身不用翻译，只有占位那一项跟着 texts.sizeLabel 走。
 */
export function sizeOptions(label = DEFAULT_TEXTS.sizeLabel) {
  return [
    { value: '', label },
    ...['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']
      .map((px) => ({ value: px, label: parseInt(px, 10) })),
  ]
}

// 前缀类命令的「已有同类前缀」判定：命中就取消，再点一次不会叠成 "- - abc"
export const QUOTE_RE = /^>\s?/
export const UL_RE = /^[-*]\s+(?!\[[ xX]\])/ // 别把任务列表当成普通无序列表
export const OL_RE = /^\d+[.)]\s+/
export const TASK_RE = /^[-*]\s+\[[ xX]\]\s+/
