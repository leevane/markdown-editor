// 文件：tests/markdown-editor.spec.js
// MarkdownEditor 组件级单测：覆盖受控值回灌、输入法保护、工具栏命令、只读、文案、
// 渲染扩展这几条「改模板就会踩到」的路径。纯函数（选区包裹 / 前缀 / 净化）在
// s78-check.mjs 里，两边互补。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarkdownEditor from '../src/MarkdownEditor.vue'

const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

// 模拟父组件的 v-model：emit 立刻回灌 props，这样连续两次工具栏操作看到的是新值。
// 顺带把「自己 emit 出去的值被回灌」这条回声路径也走了一遍。
function mountEditor(props = {}) {
  let w
  w = mount(MarkdownEditor, {
    props: {
      renderDelay: 0, // 关掉预览防抖，断言才能同步看结果
      ...props,
      'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }),
    },
  })
  return w
}

// marked 行内扩展：==高亮== → <mark>
const markExtension = {
  name: 'mark',
  level: 'inline',
  start(src) { return src.indexOf('==') },
  tokenizer(src) {
    const m = /^==([^=]+)==/.exec(src)
    if (m) {
      return { type: 'mark', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) }
    }
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline(token.tokens)}</mark>`
  },
}
const stableRenderOptions = { extensions: [markExtension] }

describe('MarkdownEditor · 受控值', () => {
  it('初始值要写进 textarea（组件不做 :value 绑定）', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '# 标题', renderDelay: 0 } })
    await nextTick()
    expect(w.find('textarea').element.value).toBe('# 标题')
    expect(w.find('.md-preview').html()).toContain('id="标题"')
  })

  it('输入时 emit update:modelValue 与 change', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '' } })
    await w.find('textarea').setValue('新内容')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['新内容'])
    expect(w.emitted('change').at(-1)).toEqual(['新内容'])
  })

  it('父组件回灌外部值时 textarea 跟着变', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'a' } })
    await w.setProps({ modelValue: '外部内容' })
    await nextTick()
    expect(w.find('textarea').element.value).toBe('外部内容')
  })

  it('输入法拼字期间不被打断，compositionend 后再同步', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'abc' } })
    const ta = w.find('textarea').element
    ta.dispatchEvent(new Event('compositionstart'))
    // 拼字过程中父组件塞了个外部值：此时不该回写 DOM，否则候选词被打断
    await w.setProps({ modelValue: '外部值' })
    await nextTick()
    expect(ta.value).toBe('abc')
    // 拼字结束：以此时代码区里的内容为准重新 emit
    ta.dispatchEvent(new Event('compositionend', { bubbles: true }))
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['abc'])
  })

  it('外部改动会清空撤销历史', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'abc' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(0, 3)
    await w.find('[title^="加粗"]').trigger('click')
    expect(w.find('[title="撤销 (Ctrl+Z)"]').attributes('disabled')).toBeUndefined()

    await w.setProps({ modelValue: '外部重置' })
    await nextTick()
    expect(w.find('[title="撤销 (Ctrl+Z)"]').attributes('disabled')).toBeDefined()
  })
})

describe('MarkdownEditor · 工具栏命令', () => {
  it('加粗插标记，再点一次取消', async () => {
    const w = mountEditor({ modelValue: 'abc' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(0, 3)

    await w.find('[title^="加粗"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['**abc**'])

    await raf() // 等 restore() 把光标还原到标记之间
    await w.find('[title^="加粗"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['abc'])
  })

  it('列表前缀不会劈开行内文字，可再点取消', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'abcdef' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(3, 3) // 光标在行中间

    await w.find('[title="无序列表"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['- abcdef'])
  })

  it('分割线插入时前后留空行', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '第一行\n第二行' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(4, 4)
    await w.find('[title="分割线"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['第一行\n\n---\n\n第二行'])
  })
})

describe('MarkdownEditor · 开关与文案', () => {
  it('只读：不渲染插入工具，模式切换仍在', async () => {
    const w = mount(MarkdownEditor, { props: { readonly: true, modelValue: 'x' } })
    expect(w.find('[title^="加粗"]').exists()).toBe(false)
    expect(w.findAll('.md-mode .md-tb')).toHaveLength(3)
    expect(w.vm.insert('y')).toBe(false)
  })

  it('showToolbar=false 时模式切换不跟着消失', () => {
    const w = mount(MarkdownEditor, {
      props: { showToolbar: false, mode: 'preview', modelValue: 'x' },
    })
    expect(w.find('[title^="加粗"]').exists()).toBe(false)
    expect(w.findAll('.md-mode .md-tb')).toHaveLength(3)
  })

  it('texts 可覆盖文案，未覆盖的走默认中文', () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: 'x', texts: { modeEdit: 'Edit', wordsLabel: 'Words' } },
    })
    const texts = w.findAll('.md-mode .md-tb').map((b) => b.text())
    expect(texts).toEqual(['Edit', '分屏', '预览'])
    expect(w.find('.md-status').text()).toContain('Words')
    expect(w.find('.md-status').text()).toContain('行数')
  })

  it('texts.tools 按工具 id 覆盖按钮提示，漏传的键回落到默认值', () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: 'x', texts: { tools: { bold: 'Bold' } } },
    })
    const bold = w.find('[title^="Bold"]')
    expect(bold.exists()).toBe(true)
    // 名字来自 texts，后缀 (Ctrl+B) 是组件按当前键位补的：两者拼接才是完整提示
    expect(bold.attributes('aria-label')).toBe('Bold (Ctrl+B)')
    // 只改了一个键，其余 18 个不该被一起抹成空 title
    expect(w.find('[title^="斜体"]').exists()).toBe(true)
    expect(w.find('[title^="撤销"]').exists()).toBe(true)
  })

  it('改键位后工具栏提示跟着改，不会留下假提示', () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: 'x', shortcuts: { bold: 'alt+b' } },
    })
    expect(w.find('[title^="加粗"]').attributes('title')).toBe('加粗 (Alt+B)')
    // 只改了加粗，其余三个仍显示默认键位
    expect(w.find('[title^="斜体"]').attributes('title')).toBe('斜体 (Ctrl+I)')
  })

  it('关掉某个动作的键位，提示里就不带后缀；全关时四个动作都没有后缀', () => {
    const one = mount(MarkdownEditor, {
      props: { modelValue: 'x', shortcuts: { bold: false } },
    })
    expect(one.find('[title^="加粗"]').attributes('title')).toBe('加粗')

    const all = mount(MarkdownEditor, { props: { modelValue: 'x', shortcuts: false } })
    const four = ['加粗', '斜体', '链接', '行内代码']
      .map((name) => all.find(`[title^="${name}"]`).attributes('title'))
    expect(four).toEqual(['加粗', '斜体', '链接', '行内代码'])
    // 撤销 / 重做不受 shortcuts 影响：它们要同步历史栈，不开放配置
    expect(all.find('[title="撤销 (Ctrl+Z)"]').exists()).toBe(true)
  })

  it('标题 / 字号下拉的选项文案也能翻', () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: 'x', texts: { headingParagraph: 'Paragraph', sizeLabel: 'Size' } },
    })
    const opts = w.findAll('select.md-select option').map((o) => o.text())
    expect(opts).toContain('Paragraph')
    expect(opts).toContain('Size')
    expect(opts).not.toContain('正文')
  })

  it('language="en" 一个 prop 换整套文案，不用逐条传 texts', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', language: 'en' } })
    expect(w.findAll('.md-mode .md-tb').map((b) => b.text())).toEqual(['Edit', 'Split', 'Preview'])
    expect(w.find('.md-status').text()).toContain('Words')
    // 工具栏提示、标题下拉、字号占位项也一起翻
    expect(w.find('.md-toolbar [title^="Bold"]').attributes('title')).toBe('Bold (Ctrl+B)')
    const opts = w.findAll('select.md-select option').map((o) => o.text())
    expect(opts).toContain('Paragraph')
    expect(opts).toContain('Size')
    // 标题提示 + 可见文字里不该再漏下中文（模板注释是中文，用 text/属性判断而不是 html）
    const tips = w.findAll('.md-toolbar [title]').map((el) => el.attributes('title')).join(' ')
    expect(tips).not.toMatch(/[\u4e00-\u9fa5]/)
    expect(w.text()).not.toMatch(/[\u4e00-\u9fa5]/)
  })

  it('language="en" 时插入正文的占位文字也是英文（snippets 跟着语言走）', async () => {
    // 界面翻了、插入内容没翻，点一下加粗就会往正文里塞「**加粗文字**」——
    // 这条用例专门盯这个只有点了按钮才看得见的漏翻点。
    const w = mountEditor({ modelValue: '', language: 'en' })
    await w.find('.md-toolbar [title^="Bold"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['**bold text**'])
  })

  it('language="en" 时表格模板用英文列名与单元格', async () => {
    const w = mountEditor({ modelValue: '', language: 'en' })
    await w.find('.md-toolbar [title="Table"]').trigger('click')
    const v = w.emitted('update:modelValue').at(-1)[0]
    expect(v).toContain('| Col 1 | Col 2 | Col 3 |')
    expect(v).toContain('| Cell | Cell | Cell |')
    expect(v).not.toMatch(/[\u4e00-\u9fa5]/)
  })

  it('texts.snippets 可只改一个词，其余键仍走语言包', async () => {
    const w = mountEditor({
      modelValue: '', language: 'en', texts: { snippets: { bold: 'STRONG' } },
    })
    await w.find('.md-toolbar [title^="Bold"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['**STRONG**'])

    // 没被覆盖的键不能被浅合并抹成 undefined
    await w.find('.md-toolbar [title="Table"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)[0]).toContain('| Col 1 |')
  })

  it('没注册过的语言码退回中文，不会渲染空白', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', language: 'ja' } })
    expect(w.findAll('.md-mode .md-tb').map((b) => b.text())).toEqual(['编辑', '分屏', '预览'])
    expect(w.find('.md-toolbar [title^="加粗"]').exists()).toBe(true)
  })

  it('texts 优先级高于 language，可只改其中一句', () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: 'x', language: 'en', texts: { wordsLabel: 'Word count' } },
    })
    expect(w.find('.md-status').text()).toContain('Word count')
    expect(w.findAll('.md-mode .md-tb').map((b) => b.text())).toEqual(['Edit', 'Split', 'Preview'])
  })

  it('showStatus=false 时不渲染状态栏', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', showStatus: false } })
    expect(w.find('.md-status').exists()).toBe(false)
  })

  it('模式受控时点击只 emit，不改内部状态', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', mode: 'split' } })
    await w.findAll('.md-mode .md-tb')[2].trigger('click')
    expect(w.emitted('update:mode').at(-1)).toEqual(['preview'])
  })
})

describe('MarkdownEditor · 渲染扩展', () => {
  it('自定义 marked 扩展生效', async () => {
    const w = mount(MarkdownEditor, {
      props: { modelValue: '==高亮==', renderOptions: stableRenderOptions, renderDelay: 0 },
    })
    await nextTick()
    const html = w.find('.md-preview').html()
    expect(html).toContain('<mark>高亮</mark>')
  })

  it('换一份 renderOptions 能立刻生效（实例缓存按引用命中）', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '==高亮==', renderDelay: 0 } })
    await nextTick()
    expect(w.find('.md-preview').html()).not.toContain('<mark>')

    await w.setProps({ renderOptions: stableRenderOptions })
    await nextTick()
    expect(w.find('.md-preview').html()).toContain('<mark>')
  })

  it('预览内容始终经过净化', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '<img src=x onerror="alert(1)">', renderDelay: 0 } })
    await nextTick()
    expect(w.find('.md-preview').html()).not.toContain('onerror')
  })

  it('idPrefix 让同页两个实例不撞标题 id', async () => {
    const a = mount(MarkdownEditor, { props: { modelValue: '# 标题', idPrefix: 'a-', renderDelay: 0 } })
    const b = mount(MarkdownEditor, { props: { modelValue: '# 标题', idPrefix: 'b-', renderDelay: 0 } })
    await nextTick()
    expect(a.find('.md-preview').html()).toContain('id="a-标题"')
    expect(b.find('.md-preview').html()).toContain('id="b-标题"')
  })
})

describe('MarkdownEditor · 主题', () => {
  it('theme 落到根节点的 data-theme 上（CSS 变量靠它切换）', () => {
    expect(mount(MarkdownEditor, { props: { theme: 'dark' } }).find('.md-editor').attributes('data-theme')).toBe('dark')
    expect(mount(MarkdownEditor, { props: { theme: 'auto' } }).find('.md-editor').attributes('data-theme')).toBe('auto')
    // 默认 light
    expect(mount(MarkdownEditor).find('.md-editor').attributes('data-theme')).toBe('light')
  })

  // 品牌色走内联变量：内联优先级最高，亮色 / 深色 / 跟随系统三种主题一次覆盖到位。
  // 外部 CSS 覆盖会被 scoped 的属性选择器压住，所以这条路必须是 prop 而不是文档里的 CSS 片段。
  const accentOf = (w) => w.find('.md-editor').element.style.getPropertyValue('--md-accent').trim()
  const contrastOf = (w) => w.find('.md-editor').element.style.getPropertyValue('--md-accent-contrast').trim()

  it('不传 accentColor 时不写变量，交给 CSS 的默认值', () => {
    expect(accentOf(mount(MarkdownEditor))).toBe('')
    expect(contrastOf(mount(MarkdownEditor))).toBe('')
  })

  it('传 accentColor 就落到根节点的内联变量上', () => {
    const w = mount(MarkdownEditor, { props: { accentColor: '#2563eb' } })
    expect(accentOf(w)).toBe('#2563eb')
    expect(contrastOf(w)).toBe('#ffffff')
  })

  it('浅色品牌色自动换深字（白字贴浅底看不见）', () => {
    const w = mount(MarkdownEditor, { props: { accentColor: '#fbbf24' } })
    expect(accentOf(w)).toBe('#fbbf24')
    expect(contrastOf(w)).toBe('#111827')
  })

  it('内置绿仍配白字，不擅自改掉默认观感', () => {
    expect(contrastOf(mount(MarkdownEditor, { props: { accentColor: '#46ba86' } }))).toBe('#ffffff')
  })

  it('空字符串 / 纯空格等于没传，不要写空变量（会让 var() 全部失效）', () => {
    expect(accentOf(mount(MarkdownEditor, { props: { accentColor: '' } }))).toBe('')
    expect(accentOf(mount(MarkdownEditor, { props: { accentColor: '   ' } }))).toBe('')
  })

  it('解析不了的颜色照写变量，字色退回白字', () => {
    const w = mount(MarkdownEditor, { props: { accentColor: 'tomato' } })
    expect(accentOf(w)).toBe('tomato')
    expect(contrastOf(w)).toBe('#ffffff')
  })

  it('深色主题下变量照样在（覆盖不依赖 data-theme）', () => {
    const w = mount(MarkdownEditor, { props: { accentColor: '#7c3aed', theme: 'dark' } })
    expect(w.find('.md-editor').attributes('data-theme')).toBe('dark')
    expect(accentOf(w)).toBe('#7c3aed')
    expect(contrastOf(w)).toBe('#ffffff')
  })

  it('改 accentColor 会立刻更新（响应式，不用重建组件）', async () => {
    const w = mount(MarkdownEditor, { props: { accentColor: '#2563eb' } })
    await w.setProps({ accentColor: '#fbbf24' })
    expect(accentOf(w)).toBe('#fbbf24')
    expect(contrastOf(w)).toBe('#111827')
  })
})

describe('MarkdownEditor · 无障碍', () => {
  it('工具栏 / 模式组 / 文本框 / 预览 / 状态栏都有角色或可读名称', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    const bar = w.find('.md-toolbar')
    expect(bar.attributes('role')).toBe('toolbar')
    expect(bar.attributes('aria-label')).toBe('编辑工具栏')
    expect(w.find('.md-mode').attributes('role')).toBe('group')
    expect(w.find('textarea').attributes('aria-label')).toBe('Markdown 源码')
    expect(w.find('.md-preview').attributes('tabindex')).toBe('0')
    expect(w.find('.md-preview').attributes('role')).toBe('region')
    expect(w.find('.md-status').attributes('role')).toBe('status')
    expect(w.find('.md-status').attributes('aria-live')).toBe('polite')
  })

  it('图标按钮有 aria-label（读屏只认 label，不认 title）', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    expect(w.find('[title^="加粗"]').attributes('aria-label')).toBe('加粗 (Ctrl+B)')
    // 自定义 aria-label 也能用 texts 换掉
    const en = mount(MarkdownEditor, { props: { modelValue: 'x', texts: { toolbarLabel: 'Toolbar' } } })
    expect(en.find('.md-toolbar').attributes('aria-label')).toBe('Toolbar')
  })
})

describe('MarkdownEditor · 边界值', () => {
  it('非法 mode 退到分屏，不会两个面板同时显示', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', mode: 'wysiwyg' } })
    expect(w.find('.md-split').classes()).not.toContain('single')
    expect(w.findAll('.md-mode .md-tb').filter((b) => b.attributes('aria-pressed') === 'true')[0].text()).toBe('分屏')
  })

  it("placeholder 传 '' 就是不要占位文案", () => {
    expect(mount(MarkdownEditor, { props: { placeholder: '' } }).find('textarea').attributes('placeholder')).toBe('')
    expect(mount(MarkdownEditor, { props: {} }).find('textarea').attributes('placeholder')).toBe('在这里用 Markdown 写作……')
  })
})

// 伪造剪贴板事件：jsdom 没有实现 DataTransfer，直接往 Event 上挂 clipboardData
function pasteEvent(data) {
  const ev = new Event('paste', { bubbles: true, cancelable: true })
  ev.clipboardData = {
    files: data.files || [],
    getData: (type) => data[type] || '',
  }
  return ev
}

describe('MarkdownEditor · 粘贴', () => {
  it('富文本粘贴转成 Markdown 并插入光标处', async () => {
    const w = mountEditor({ modelValue: 'ab' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(1, 1)

    ta.dispatchEvent(pasteEvent({
      'text/html': '<h2>小标题</h2><p>正文<strong>重点</strong></p>',
      'text/plain': '小标题 正文重点',
    }))

    await vi.waitFor(() => {
      expect(w.emitted('update:modelValue').at(-1)?.[0]).toContain('## 小标题')
    })
    const out = w.emitted('update:modelValue').at(-1)[0]
    expect(out).toContain('**重点**')
    expect(out.startsWith('a\n\n')).toBe(true) // 多块内容插在行中：前面补空行
  })

  it('纯文本粘贴不拦（交回浏览器默认行为）', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    const ev = pasteEvent({ 'text/html': '<span>abc</span>', 'text/plain': 'abc' })
    w.find('textarea').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('粘贴图片只上报文件，不写正文', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    const file = new File(['png'], 'a.png', { type: 'image/png' })
    const ev = pasteEvent({ files: [file] })
    w.find('textarea').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(w.emitted('paste-image')[0][0]).toHaveLength(1)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('pasteHtml=false 时完全不管粘贴', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', pasteHtml: false } })
    const ev = pasteEvent({ 'text/html': '<h2>标题</h2>' })
    w.find('textarea').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })
})

describe('MarkdownEditor · 渲染防抖', () => {
  it('防抖窗口内预览不动，窗口过后一次性更新', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'a', renderDelay: 40 } })
    await nextTick()
    expect(w.find('.md-preview').html()).toContain('a') // 首屏不延迟

    await w.setProps({ modelValue: '# 新标题' })
    await nextTick()
    expect(w.find('.md-preview').html()).not.toContain('新标题')

    await new Promise((r) => setTimeout(r, 90))
    expect(w.find('.md-preview').html()).toContain('新标题')
  })

  it('getHtml 不走防抖，拿到的是最新结果', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'a', renderDelay: 200 } })
    await w.setProps({ modelValue: '# 立即' })
    expect(w.vm.getHtml()).toContain('立即')
    expect(w.find('.md-preview').html()).not.toContain('立即')
  })
})

describe('MarkdownEditor · 快捷键与编辑增强', () => {
  it('Ctrl+B 加粗选中文字', async () => {
    const w = mountEditor({ modelValue: 'abc' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(0, 3)
    await w.find('textarea').trigger('keydown', { key: 'b', ctrlKey: true })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['**abc**'])
  })

  it('Ctrl+I 斜体', async () => {
    const w = mountEditor({ modelValue: 'abc' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(0, 3)
    await w.find('textarea').trigger('keydown', { key: 'i', ctrlKey: true })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['*abc*'])
  })

  it('自定义键位覆盖默认：要 Ctrl+Shift+B 才加粗', async () => {
    const w = mountEditor({ modelValue: 'abc', shortcuts: { bold: 'mod+shift+b' } })
    const ta = w.find('textarea')
    ta.element.setSelectionRange(0, 3)
    // 默认的 Ctrl+B 已经让位，不该再触发
    await ta.trigger('keydown', { key: 'b', ctrlKey: true })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await ta.trigger('keydown', { key: 'b', ctrlKey: true, shiftKey: true })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['**abc**'])
  })

  it('shortcuts=false 关掉全部格式快捷键', async () => {
    const w = mountEditor({ modelValue: 'abc', shortcuts: false })
    const ta = w.find('textarea')
    ta.element.setSelectionRange(0, 3)
    await ta.trigger('keydown', { key: 'b', ctrlKey: true })
    await ta.trigger('keydown', { key: 'i', ctrlKey: true })
    await ta.trigger('keydown', { key: 'k', ctrlKey: true })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('单个动作写 false 不影响其他动作', async () => {
    const w = mountEditor({ modelValue: 'abc', shortcuts: { bold: false } })
    const ta = w.find('textarea')
    ta.element.setSelectionRange(0, 3)
    await ta.trigger('keydown', { key: 'b', ctrlKey: true })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await ta.trigger('keydown', { key: 'i', ctrlKey: true })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['*abc*'])
  })

  // 合并窗口的两种取值：0 = 每次改动单独一步；默认 = 连续输入并成一步
  it('undoMergeWindow=0：逐字输入各占一步历史', async () => {
    const w = mountEditor({ modelValue: '', undoMergeWindow: 0 })
    const ta = w.find('textarea')
    await ta.setValue('a')
    await ta.setValue('ab')
    w.vm.undo()
    await nextTick()
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['a'])
  })

  it('默认合并窗口：连续输入只留一步历史', async () => {
    const w = mountEditor({ modelValue: '' })
    const ta = w.find('textarea')
    await ta.setValue('a')
    await ta.setValue('ab')
    w.vm.undo()
    await nextTick()
    expect(w.emitted('update:modelValue').at(-1)).toEqual([''])
  })

  it('Tab 缩进并阻止焦点跳出', async () => {
    const w = mountEditor({ modelValue: 'ab' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(1, 1)
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    ta.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['a  b'])
  })

  it('Shift+Tab 反缩进', async () => {
    const w = mountEditor({ modelValue: '  ab' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(2, 2)
    await w.find('textarea').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['ab'])
  })

  it('多行选区 Tab 整块缩进', async () => {
    const w = mountEditor({ modelValue: 'a\nb' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(0, 3)
    await w.find('textarea').trigger('keydown', { key: 'Tab' })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['  a\n  b'])
  })

  it('回车续无序列表', async () => {
    const w = mountEditor({ modelValue: '- 一' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(3, 3)
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['- 一\n- '])
  })

  it('空列表项回车退出列表', async () => {
    const w = mountEditor({ modelValue: '- ' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(2, 2)
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue').at(-1)).toEqual([''])
  })

  it('输入法拼字中的回车不接管', async () => {
    const w = mountEditor({ modelValue: '- 一' })
    const ta = w.find('textarea').element
    ta.setSelectionRange(3, 3)
    ta.dispatchEvent(new Event('compositionstart'))
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    ta.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })
})

describe('MarkdownEditor · 工具栏激活态', () => {
  it('光标在 **…** 内，加粗按钮 aria-pressed=true 且有 on 类', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '**abc**' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(3, 5)
    await w.find('textarea').trigger('keyup')
    const bold = w.find('[title^="加粗"]')
    expect(bold.attributes('aria-pressed')).toBe('true')
    expect(bold.classes()).toContain('on')
  })

  it('普通文字里加粗按钮是 false（不是 undefined）', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'abc' } })
    await w.find('textarea').trigger('keyup')
    expect(w.find('[title^="加粗"]').attributes('aria-pressed')).toBe('false')
  })

  it('标题层级下拉反映光标所在行', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '## 二级' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(3, 3)
    await w.find('textarea').trigger('keyup')
    expect(w.find('.md-select').element.value).toBe('2')
  })

  it('列表行对应按钮点亮', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '- [ ] 待办' } })
    const ta = w.find('textarea').element
    ta.setSelectionRange(6, 6)
    await w.find('textarea').trigger('keyup')
    expect(w.find('[title="任务列表"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[title="无序列表"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('MarkdownEditor · 字数上限', () => {
  it('未设上限时不显示分母，也不标记超限', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '一句话', renderDelay: 0 } })
    await nextTick()
    expect(w.find('.md-words').text()).toBe('字数 3')
    expect(w.find('.md-words').classes()).not.toContain('over')
    expect(w.find('.md-editor').attributes('data-over-limit')).toBeUndefined()
  })

  it('设了上限就显示「当前 / 上限」，超限时加 over 类并暴露 data-over-limit', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: '一二三', maxLength: 2, renderDelay: 0 } })
    await nextTick()
    expect(w.find('.md-words').text()).toBe('字数 3 / 2')
    expect(w.find('.md-words').classes()).toContain('over')
    expect(w.find('.md-editor').attributes('data-over-limit')).toBe('true')
  })

  it('不截断输入：超限后 textarea 与 v-model 仍是完整内容', async () => {
    const w = mountEditor({ modelValue: '', maxLength: 2 })
    await w.find('textarea').setValue('一二三四五')
    expect(w.find('textarea').element.value).toBe('一二三四五')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['一二三四五'])
    expect(w.find('.md-words').classes()).toContain('over')
  })

  it('0 / 负数一律按「不限制」处理', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'abc', maxLength: -5, renderDelay: 0 } })
    await nextTick()
    expect(w.find('.md-words').text()).toBe('字数 1')
    expect(w.find('.md-words').classes()).not.toContain('over')
  })
})

describe('MarkdownEditor · 全屏', () => {
  it('点按钮进入全屏：加 is-fullscreen 类、发 update:fullscreen、按钮变「退出全屏」', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    await w.find('[title="全屏"]').trigger('click')
    expect(w.find('.md-editor').classes()).toContain('is-fullscreen')
    expect(w.emitted('update:fullscreen').at(-1)).toEqual([true])
    expect(w.find('[title="退出全屏"]').exists()).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('Esc 退出全屏，并发 update:fullscreen(false)', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x' } })
    await w.find('[title="全屏"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('.md-editor').classes()).not.toContain('is-fullscreen')
    expect(w.emitted('update:fullscreen').at(-1)).toEqual([false])
    expect(document.body.style.overflow).toBe('')
    w.unmount()
  })

  it('受控：fullscreen=true 直接是全屏，点击只发事件、外观等父组件回灌', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', fullscreen: true } })
    expect(w.find('.md-editor').classes()).toContain('is-fullscreen')
    await w.find('[title="退出全屏"]').trigger('click')
    expect(w.find('.md-editor').classes()).toContain('is-fullscreen')
    expect(w.emitted('update:fullscreen').at(-1)).toEqual([false])
    w.unmount()
  })

  it('showFullscreen=false 时不渲染全屏按钮', () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', showFullscreen: false } })
    expect(w.find('[title="全屏"]').exists()).toBe(false)
  })

  it('全屏时不再写行内 height，宽高交给 inset', async () => {
    const w = mount(MarkdownEditor, { props: { modelValue: 'x', height: 420 } })
    expect(w.find('.md-split').attributes('style')).toContain('height: 420px')
    await w.find('[title="全屏"]').trigger('click')
    expect(w.find('.md-split').attributes('style') || '').not.toContain('height')
    w.unmount()
  })
})

// ---- 图片上传：适配器接管的占位 / 回填 / 失败清理 ----
function pngFile(name) {
  return new File(['png'], name || 'cover.png', { type: 'image/png' })
}

/** 手动控制 resolve 的适配器：先看占位，再放行回填 */
function pendingAdapter() {
  let done
  const fn = vi.fn(() => new Promise((res, rej) => { done = { res, rej } }))
  return { fn, finish: (url) => done.res(url), fail: (err) => done.rej(err) }
}

describe('MarkdownEditor · 图片上传', () => {
  it('配了适配器：先插占位，完成后原地回填，不再 emit paste-image', async () => {
    const { fn, finish } = pendingAdapter()
    const w = mountEditor({ modelValue: 'ab', uploadImage: fn })
    const ta = w.find('textarea').element
    ta.setSelectionRange(2, 2)

    ta.dispatchEvent(pasteEvent({ files: [pngFile('封面图.png')] }))
    await nextTick()

    const drafting = w.emitted('update:modelValue').at(-1)[0]
    expect(drafting).toContain('![封面图](uploading:')
    expect(w.emitted('paste-image')).toBeUndefined()
    expect(w.find('.md-uploading').text()).toContain('正在上传 1')

    finish('https://cdn.example.com/a.png')
    await vi.waitFor(() => {
      expect(w.emitted('update:modelValue').at(-1)[0]).toContain('![封面图](https://cdn.example.com/a.png)')
    })
    expect(w.emitted('update:modelValue').at(-1)[0]).not.toContain('uploading:')
    expect(w.find('.md-uploading').exists()).toBe(false)
  })

  it('多张一起选：一次 commit 排好所有占位，各自回填', async () => {
    const urls = []
    const uploadImage = vi.fn((file) => new Promise((res) => { urls.push({ file, res }) }))
    const w = mountEditor({ modelValue: '', uploadImage })
    w.find('textarea').element.dispatchEvent(pasteEvent({ files: [pngFile('a.png'), pngFile('b.png')] }))
    await nextTick()

    const draft = w.emitted('update:modelValue').at(-1)[0]
    expect(draft.match(/uploading:/g)).toHaveLength(2)
    expect(w.find('.md-uploading').text()).toContain('正在上传 2')

    urls[0].res('https://x/a.png')
    await nextTick()
    urls[1].res('https://x/b.png')
    await vi.waitFor(() => {
      const v = w.emitted('update:modelValue').at(-1)[0]
      expect(v).toContain('![a](https://x/a.png)')
      expect(v).toContain('![b](https://x/b.png)')
    })
  })

  it('上传期间继续打字：回填只替换占位，不覆盖新输入', async () => {
    const { fn, finish } = pendingAdapter()
    const w = mountEditor({ modelValue: '开头', uploadImage: fn })
    const ta = w.find('textarea').element
    ta.setSelectionRange(2, 2)
    ta.dispatchEvent(pasteEvent({ files: [pngFile('x.png')] }))
    await nextTick()

    // 用户接着在文末写了一段
    ta.value = w.props('modelValue') + '\n后来写的'
    await w.find('textarea').trigger('input')

    finish('https://x/y.png')
    await vi.waitFor(() => {
      const v = w.emitted('update:modelValue').at(-1)[0]
      expect(v).toContain('![x](https://x/y.png)')
      expect(v).toContain('后来写的')
    })
  })

  it('适配器抛错：占位被删掉、正文回到原样，并 emit upload-error', async () => {
    const uploadImage = vi.fn(() => Promise.reject(new Error('500')))
    const w = mountEditor({ modelValue: '正文', uploadImage })
    w.find('textarea').element.dispatchEvent(pasteEvent({ files: [pngFile()] }))
    await nextTick()
    expect(w.props('modelValue')).toContain('uploading:')

    await vi.waitFor(() => {
      expect(w.emitted('upload-error')).toBeTruthy()
    })
    expect(w.props('modelValue')).toBe('正文')
    expect(w.emitted('upload-error')[0][1]).toBeInstanceOf(Error)
    expect(w.find('.md-uploading').exists()).toBe(false)
  })

  it('返回空地址按失败处理（不把空图留在正文里）', async () => {
    const uploadImage = vi.fn(async () => '   ')
    const w = mountEditor({ modelValue: '正文', uploadImage })
    w.find('textarea').element.dispatchEvent(pasteEvent({ files: [pngFile()] }))
    await vi.waitFor(() => {
      expect(w.emitted('upload-error')).toBeTruthy()
    })
    expect(w.props('modelValue')).toBe('正文')
  })

  it('适配器可以指定 alt，优先于文件名', async () => {
    const uploadImage = vi.fn(async () => ({ url: 'https://x/a.png', alt: '架构图' }))
    const w = mountEditor({ modelValue: '', uploadImage })
    w.find('textarea').element.dispatchEvent(pasteEvent({ files: [pngFile('IMG_0001.png')] }))
    await vi.waitFor(() => {
      expect(w.props('modelValue')).toContain('![架构图](https://x/a.png)')
    })
  })

  it('pickImage() 打开文件选择框，选完走同一条链路', async () => {
    const uploadImage = vi.fn(async () => 'https://x/pick.png')
    const w = mountEditor({ modelValue: '', uploadImage })
    const input = w.find('input[type=file]')
    const click = vi.spyOn(input.element, 'click').mockImplementation(() => {})
    expect(w.vm.pickImage()).toBe(true)
    expect(click).toHaveBeenCalled()

    Object.defineProperty(input.element, 'files', { value: [pngFile('pick.png')], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => {
      expect(w.props('modelValue')).toContain('![pick](https://x/pick.png)')
    })
  })

  it('没配适配器：pickImage() 返回 false，图片按钮仍是插入模板', async () => {
    const w = mountEditor({ modelValue: '' })
    expect(w.vm.pickImage()).toBe(false)
    await w.find('[title="图片"]').trigger('click')
    expect(w.props('modelValue')).toContain('![图片描述](https://)')
  })

  it('只读态不接受上传：pickImage 返回 false，粘贴也不写正文', () => {
    const uploadImage = vi.fn(async () => 'https://x/a.png')
    const w = mountEditor({ modelValue: 'x', readonly: true, uploadImage })
    expect(w.vm.pickImage()).toBe(false)
    w.find('textarea').element.dispatchEvent(pasteEvent({ files: [pngFile()] }))
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('剪贴板只有 items 没有 files 也能识别图片', async () => {
    const uploadImage = vi.fn(async () => 'https://x/item.png')
    const w = mountEditor({ modelValue: '', uploadImage })
    const ev = new Event('paste', { bubbles: true, cancelable: true })
    ev.clipboardData = {
      files: [],
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => pngFile('item.png') }],
      getData: () => '',
    }
    w.find('textarea').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    await vi.waitFor(() => {
      expect(w.props('modelValue')).toContain('![item](https://x/item.png)')
    })
  })
})
