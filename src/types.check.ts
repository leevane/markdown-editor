// 文件：packages/markdown-editor/src/types.check.ts
// 编译期类型断言：只参与 npm run typecheck，不被任何页面 import，也不进构建产物。
// 作用是把 types.ts 钉在编译链上——类型写飘了（比如 props 少一个字段、
// 方法签名变形）这里会直接编译失败，而不是等到使用者 IDE 报红才发现。
import type {
  MarkdownEditorInstance,
  MarkdownEditorMode,
  MarkdownEditorProps,
  MarkdownEditorTexts,
  ToolbarItem,
} from './types'

// 1. 合法 props 全量走一遍
const props: MarkdownEditorProps = {
  modelValue: '# hi',
  mode: 'split',
  height: 320,
  width: '100%',
  readonly: false,
  showToolbar: true,
  theme: 'dark',
  accentColor: '#2563eb',
  idPrefix: 'doc-',
  pasteHtml: true,
  placeholder: '',
  toolbar: ['history', 'bold', 'sep', { key: 'ai', icon: '<path d="M0 0"/>', onClick: () => {} }],
  texts: { modeEdit: 'Edit', cursor: (line, col) => `L${line}C${col}`, toolbarLabel: 'Toolbar' },
  renderOptions: { extensions: [], sanitize: true },
}
void props

// 1.1 theme 只有三档
// @ts-expect-error 'sepia' 不是受支持的主题
const badTheme: MarkdownEditorProps = { theme: 'sepia' }
void badTheme

// 1.2 品牌色是颜色字符串，不是对象 / 数字
// @ts-expect-error accentColor 只收 string
const badAccent: MarkdownEditorProps = { accentColor: 0x2563eb }
void badAccent

// 2. mode 只接受三态
// @ts-expect-error 'wysiwyg' 不在 edit / split / preview 里
const badMode: MarkdownEditorMode = 'wysiwyg'
void badMode

// 3. 暴露方法的签名
const inst = {} as MarkdownEditorInstance
const inserted: boolean = inst.insert('x')
inst.setMode('preview')
void inserted

// @ts-expect-error insert 只接字符串
inst.insert(1)

// 4. texts.cursor 的两个参数是数字
const texts: MarkdownEditorTexts = { cursor: (line: number, col: number) => `${line}:${col}` }
void texts

// 5. 工具栏项：字符串组名 / 工具 id / 自定义对象
const tool: ToolbarItem = { icon: '<path d="M0 0"/>', onClick: () => {} }
void tool
