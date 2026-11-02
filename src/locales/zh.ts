// 文件：packages/markdown-editor/src/locales/zh.ts
// 中文语言包（默认语言）。类型注解是 ResolvedTexts，少写一个字段会直接编译报错——
// 这是故意的：宁可写的时候报错，也别让一句中文漏在日文 / 英文界面里。
// 只放数据：不 import vue、不进响应式。
import type { ResolvedTexts } from '../types'

export const ZH_TEXTS = {
  placeholder: '在这里用 Markdown 写作……',
  sourceLabel: 'Markdown 源码',
  previewLabel: '实时预览（已净化）',
  modeEdit: '编辑',
  modeSplit: '分屏',
  modePreview: '预览',
  wordsLabel: '字数',
  linesLabel: '行数',
  cursor: (line, col) => `第 ${line} 行 · 第 ${col} 列`,
  // 无障碍：读屏软件先读角色名，再读里面的按钮，光有 title 不够
  toolbarLabel: '编辑工具栏',
  viewModeLabel: '显示模式',
  // 全屏按钮的两个状态分开写：按钮的 aria-label 会随状态切换，读屏能读到变化
  fullscreenEnter: '全屏',
  fullscreenExit: '退出全屏',
  // 状态栏的上传提示：只在有待上传图片时出现，传的是张数
  uploading: (count) => `正在上传 ${count}`,
  headingParagraph: '正文',
  sizeLabel: '字号',
  // 插入到正文里的占位文字：界面翻了这里没翻，英文站点一下加粗就会塞进中文
  snippets: {
    text: '文字',
    quote: '引用内容',
    listItem: '列表项',
    taskItem: '待办事项',
    bold: '加粗文字',
    italic: '斜体',
    strike: '删除线',
    inlineCode: 'code',
    link: '链接文字',
    image: '图片描述',
    tableColumn: (i) => `列${i}`,
    tableCell: '内容',
    codeBlock: '// 代码',
  },
  // 工具名只写名字：后缀「(Ctrl+B)」由 toolbar/registry.ts 按当前键位表现算，
  // 因为键位可以改也可以关，写死在语言包里就会变成假提示。
  tools: {
    undo: '撤销',
    redo: '重做',
    heading: '标题层级',
    size: '字号',
    color: '文字颜色',
    bg: '背景颜色',
    quote: '引用',
    ul: '无序列表',
    ol: '有序列表',
    task: '任务列表',
    hr: '分割线',
    table: '表格',
    bold: '加粗',
    italic: '斜体',
    strike: '删除线',
    inlineCode: '行内代码',
    codeBlock: '代码块',
    link: '链接',
    image: '图片',
  },
} satisfies ResolvedTexts
