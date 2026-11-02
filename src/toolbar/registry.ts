// 文件：packages/markdown-editor/src/toolbar/registry.ts
// 工具栏注册表：把「配置数组」翻译成「要渲染的组件 + props」。
//
// 分层在这里的意义：
//   · createToolBuilders 只描述「每个工具长什么样、点了干什么」；
//   · GROUPS 只描述「哪些工具归一组」；
//   · resolveTools 负责把使用方的 toolbar 配置展开、去重、收尾分隔线。
// 三者分开后，加一个按钮 = 注册表加一行 + GROUPS 里挂上去，主组件一行都不用改。
import type { Component } from 'vue'
import type { EditorActiveState } from '../core/markdown'
import type { ResolvedTexts, ToolbarCustomTool, ToolbarItem, ToolbarToolKey } from '../types'
import type { useEditorCommands } from '../composables/useEditorCommands'
import { ICONS } from './icons'
import { formatShortcut } from '../core/shortcuts'
import type { ShortcutMap } from '../core/shortcuts'
import {
  headingOptions, sizeOptions, QUOTE_RE, UL_RE, OL_RE, TASK_RE,
} from '../config'

/** 工具描述：模板里统一用 <component :is> 渲染 */
export interface ToolView {
  key: string
  component: Component
  props: Record<string, unknown>
}

/** 四个工具栏小组件由主组件注入，注册表本身不 import 任何 .vue */
export interface ToolComponents {
  Button: Component
  Select: Component
  Color: Component
  Sep: Component
}

export interface ToolContext {
  /** 组件注入的四个渲染组件 */
  components: ToolComponents
  /** 命令层（useEditorCommands 的返回值）+ 撤销重做（历史栈在组件手里） */
  commands: ReturnType<typeof useEditorCommands> & { undo: () => void; redo: () => void }
  canUndo: () => boolean
  canRedo: () => boolean
  /** 当前激活态；用 getter 传，注册表才能跟着光标变化重算 */
  active: () => EditorActiveState
  /** 界面文案；同样用 getter，texts 改了工具栏要跟着换语言 */
  texts: () => ResolvedTexts
  /** 当前生效的键位表；提示里的「(Ctrl+B)」跟着它变 */
  shortcuts: () => ShortcutMap
  /**
   * 配置了 uploadImage 时，图片按钮改为打开文件选择框（由主组件注入）。
   * 不传则保持「插入 ![alt](https://) 模板」的老行为。
   */
  openImagePicker?: () => void
}

export const GROUPS: Record<string, string[]> = {
  history: ['undo', 'redo'],
  heading: ['heading'],
  block: ['quote', 'ul', 'ol', 'task', 'hr', 'table'],
  inline: ['bold', 'italic', 'strike', 'inlineCode', 'codeBlock', 'link', 'image'],
  style: ['color', 'size', 'bg'],
}

/** 构建 id → 工具描述 的注册表。每次 visibleTools 重算时调一次，成本可忽略 */
export function createToolBuilders(ctx: ToolContext): Record<string, () => ToolView> {
  const { components: C, commands, canUndo, canRedo, active, texts, shortcuts } = ctx

  /**
   * 撤销 / 重做的键位不开放配置（要同步历史栈），但提示里的写法仍走同一个格式化，
   * 免得文案里出现「Ctrl + Z」「ctrl+z」各写各的。
   */
  const FIXED_HINTS: Record<string, string> = { undo: 'mod+z', redo: 'mod+y' }

  /**
   * 工具提示文案：语言包里的纯名字 + 由键位表算出来的「(Ctrl+B)」。
   * 后缀不写在语言包里的原因——键位可配，写死就会出现「提示说 Ctrl+B，按下去没反应」。
   * 宿主把某个动作关掉（传 false）时，后缀自动消失，不会留在界面上骗人。
   */
  const T = (key: ToolbarToolKey) => {
    const label = texts().tools[key]
    const hint = formatShortcut(shortcuts()[key] ?? FIXED_HINTS[key])
    return hint ? `${label} (${hint})` : label
  }

  /**
   * 插入到正文里的占位文字（加粗文字 / 列表项 / 表格列名…）。
   * 和 T 一样按当前语言实时取，换 language 立刻生效，不用重建工具栏。
   */
  const S = () => texts().snippets

  /**
   * 按钮工具。
   * pressed 只能是 true / false / null（null = 纯动作按钮，不输出 aria-pressed，
   * 否则读屏会把「分割线」念成「未按下」）。
   */
  function btn(
    key: string, icon: string, title: string, action: () => void,
    opts: { disabled?: boolean; pressed?: boolean } = {},
  ): ToolView {
    return {
      key,
      component: C.Button,
      props: {
        icon,
        title,
        disabled: !!opts.disabled,
        pressed: opts.pressed === undefined ? null : opts.pressed,
        onAction: action,
      },
    }
  }

  const select = (key: string, title: string, options: unknown[], modelValue: string, onChange: (v: string) => void): ToolView => ({
    key,
    component: C.Select,
    props: { title, options, modelValue, onChange },
  })

  const color = (key: string, title: string, kind: 'text' | 'bg', modelValue: string, onChange: (v: string) => void): ToolView => ({
    key,
    component: C.Color,
    props: { kind, title, modelValue, onChange },
  })

  return {
    undo: () => btn('undo', ICONS.undo, T('undo'), commands.undo, { disabled: !canUndo() }),
    redo: () => btn('redo', ICONS.redo, T('redo'), commands.redo, { disabled: !canRedo() }),

    heading: () => select('heading', T('heading'), headingOptions(texts().headingParagraph), active().heading, (v) => commands.heading(Number(v))),
    size: () => select('size', T('size'), sizeOptions(texts().sizeLabel), '', (v) => commands.applyStyle('size', v, S().text)),
    color: () => color('color', T('color'), 'text', '#e06c75', (v) => commands.applyStyle('color', v, S().text)),
    bg: () => color('bg', T('bg'), 'bg', '#fff3cd', (v) => commands.applyStyle('bg', v, S().text)),

    // 下面这些的占位文字会真的写进正文，所以跟界面文案一样走语言包（snippets）
    quote: () => btn('quote', ICONS.quote, T('quote'), () => commands.line('> ', S().quote, QUOTE_RE), { pressed: active().quote }),
    ul: () => btn('ul', ICONS.ul, T('ul'), () => commands.line('- ', S().listItem, UL_RE), { pressed: active().ul }),
    ol: () => btn('ol', ICONS.ol, T('ol'), () => commands.line('1. ', S().listItem, OL_RE), { pressed: active().ol }),
    task: () => btn('task', ICONS.task, T('task'), () => commands.line('- [ ] ', S().taskItem, TASK_RE), { pressed: active().task }),
    hr: () => btn('hr', ICONS.hr, T('hr'), commands.hr),
    table: () => btn('table', ICONS.table, T('table'), () => commands.table(S().tableColumn, S().tableCell)),

    bold: () => btn('bold', ICONS.bold, T('bold'), () => commands.wrap('**', S().bold), { pressed: active().bold }),
    italic: () => btn('italic', ICONS.italic, T('italic'), () => commands.wrap('*', S().italic), { pressed: active().italic }),
    strike: () => btn('strike', ICONS.strike, T('strike'), () => commands.wrap('~~', S().strike), { pressed: active().strike }),
    inlineCode: () => btn('inlineCode', ICONS.inlineCode, T('inlineCode'), () => commands.wrap('`', S().inlineCode), { pressed: active().inlineCode }),
    codeBlock: () => btn('codeBlock', ICONS.codeBlock, T('codeBlock'), () => commands.codeBlock(S().codeBlock)),
    link: () => btn('link', ICONS.link, T('link'), () => commands.link(S().link)),
    // 图片按钮有两种人格：配了适配器就选文件上传，没配就只插模板等宿主接管
    image: () => btn('image', ICONS.image, T('image'), () => (
      ctx.openImagePicker ? ctx.openImagePicker() : commands.image(S().image)
    )),
  }
}

function isCustomTool(item: ToolbarItem): item is ToolbarCustomTool {
  return (
    typeof item === 'object' && item !== null &&
    typeof (item as ToolbarCustomTool).icon === 'string' &&
    typeof (item as ToolbarCustomTool).onClick === 'function'
  )
}

/**
 * toolbar 配置 → 工具描述数组：
 *   '组名'        → 展开成内置工具并补分隔线
 *   '工具 id'     → 单个内置工具
 *   'sep'         → 手动一条分隔线
 *   { key, icon, title, onClick } → 业务自定义工具，图标与内置同一套 SVG 规范
 * 最后统一去重、去掉首尾多余分隔。
 */
export function resolveTools(
  config: ToolbarItem[],
  deps: { builders: Record<string, () => ToolView>; button: Component; sep: Component },
): ToolView[] {
  const { builders, button, sep } = deps
  const out: ToolView[] = []
  const pushSep = (key: string) => out.push({ key, component: sep, props: {} })

  for (const item of config) {
    if (typeof item === 'string' && GROUPS[item]) {
      for (const id of GROUPS[item]) out.push(builders[id]())
      pushSep(`sep:${item}`)
    } else if (item === 'sep') {
      pushSep('sep:manual')
    } else if (typeof item === 'string' && builders[item]) {
      out.push(builders[item]())
    } else if (isCustomTool(item)) {
      out.push({
        key: item.key || `custom-${out.length}`,
        component: button,
        props: { icon: item.icon, title: item.title || '', pressed: null, disabled: false, onAction: item.onClick },
      })
    }
  }
  return normalize(out, sep)
}

/** 去重 + 收尾：连续分隔只留一条，末尾不挂分隔线 */
function normalize(tools: ToolView[], sep: Component): ToolView[] {
  const seen = new Set<string>()
  const res: ToolView[] = []
  for (const tool of tools) {
    if (tool.component === sep) {
      if (res.length && res[res.length - 1].component !== sep) res.push(tool)
    } else if (!seen.has(tool.key)) {
      seen.add(tool.key)
      res.push(tool)
    }
  }
  while (res.length && res[res.length - 1].component === sep) res.pop()
  return res
}
