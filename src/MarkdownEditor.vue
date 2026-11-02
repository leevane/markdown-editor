<template>
  <div
    class="md-editor"
    :class="{ 'is-fullscreen': isFullscreen }"
    :style="[accentStyle, rootSizeStyle]"
    :data-theme="theme"
    :data-over-limit="overLimit ? 'true' : undefined"
  >
    <!-- 工具栏：toolbar 配置 → 工具描述数组 → 统一渲染，加按钮只需在注册表补一条 -->
    <!-- showMode 与 showToolbar 两个开关分开：只读时藏掉插入类工具，模式切换照常可用 -->
    <!-- 全屏按钮挂在工具栏里，所以整条工具栏关掉时它也跟着消失（只读公告不需要它） -->
    <div
      v-if="showToolbar || showMode"
      class="md-toolbar"
      role="toolbar"
      :aria-label="t.toolbarLabel"
      aria-orientation="horizontal"
    >
      <template v-if="showToolbar && !readonly">
        <component
          :is="tool.component"
          v-for="tool in visibleTools"
          :key="tool.key"
          v-bind="tool.props"
        />

        <!-- 业务方自定义按钮挂这里；作用域暴露 insert / getHtml，方便直接操作内容 -->
        <slot name="toolbar-append" :insert="insert" :get-html="getHtml"></slot>
      </template>

      <!-- 右侧「怎么显示」是一组：模式切换 + 全屏。包在同一个容器里，工具栏被迫换行时
           整组一起下去，不会出现「模式组在这一行、全屏按钮孤零零落到下一行」 -->
      <span v-if="showMode || showFullscreen" class="md-view-group">
        <span v-if="showMode" class="md-mode" role="group" :aria-label="t.viewModeLabel">
          <button
            v-for="m in MODES"
            :key="m.value"
            class="md-tb"
            :class="{ on: currentMode === m.value }"
            :aria-pressed="currentMode === m.value"
            type="button"
            @click="setMode(m.value)"
          >{{ t[m.label] }}</button>
        </span>

        <!-- 全屏按钮排在模式组右侧：两者都是「怎么显示」，放一起比塞进格式工具里更好找 -->
        <span v-if="showFullscreen" class="md-view">
          <ToolbarButton
            :icon="isFullscreen ? ICONS.fullscreenExit : ICONS.fullscreen"
            :title="isFullscreen ? t.fullscreenExit : t.fullscreenEnter"
            :pressed="isFullscreen"
            @action="toggleFullscreen"
          />
        </span>
      </span>
    </div>

    <!-- 编辑 / 预览：同一行等高，面板内各自滚动；全屏时高度交给 flex，不写死行内值 -->
    <div
      class="md-split"
      :class="{ single: currentMode !== 'split' }"
      :style="isFullscreen ? undefined : { height: cssHeight }"
    >
      <div v-show="currentMode !== 'preview'" class="md-pane" @pointerdown="unlock" @wheel.passive="unlock">
        <div v-if="showLabels" class="md-pane-label">{{ t.sourceLabel }}</div>
        <textarea
          ref="ta"
          class="md-textarea"
          :readonly="readonly"
          :placeholder="placeholder ?? t.placeholder"
          :aria-label="t.sourceLabel"
          aria-multiline="true"
          @input="onInput"
          @keydown="onKeydown"
          @scroll="onTextScroll"
          @keyup="syncCursor"
          @click="syncCursor"
          @select="syncCursor"
          @paste="onPaste"
          @drop="onDrop"
          @compositionstart="composing = true"
          @compositionend="onCompositionEnd"
        ></textarea>
      </div>
      <div v-show="currentMode !== 'edit'" class="md-pane" @pointerdown="unlock" @wheel.passive="unlock">
        <div v-if="showLabels" class="md-pane-label">{{ t.previewLabel }}</div>
        <!-- tabindex=0：键盘用户也能聚焦进来用方向键滚预览，否则只能靠鼠标 -->
        <div
          ref="previewRef"
          class="md-preview md-body"
          role="region"
          :aria-label="t.previewLabel"
          tabindex="0"
          v-html="displayHtml"
          @scroll="onPreviewScroll"
        ></div>
      </div>
    </div>

    <!-- 状态栏：纯信息展示，不放任何业务操作；业务按钮放组件外面自己排 -->
    <!-- role=status + aria-live：字数 / 行数变化对读屏用户可感知（拼字期间不触发） -->
    <div v-if="showStatus" class="md-status" role="status" aria-live="polite" aria-atomic="true">
      <span class="md-words" :class="{ over: overLimit }">
        {{ t.wordsLabel }} <b>{{ words }}</b><template v-if="wordLimit > 0"> / {{ wordLimit }}</template>
      </span>
      <span>{{ t.linesLabel }} <b>{{ lineCount }}</b></span>
      <!-- 上传进度只报张数：每张的百分比要靠 XHR 的 progress 事件，那属于宿主的适配器 -->
      <span v-if="pendingUploads > 0" class="md-uploading">{{ t.uploading(pendingUploads) }}</span>
      <span class="md-cursor">{{ t.cursor(cursorLine, cursorCol) }}</span>
    </div>

    <!-- 文件选择框：display:none，不进布局也不进 Tab 顺序；uploadImage 未配置时它不会被触发 -->
    <input
      ref="fileInput"
      class="md-file"
      type="file"
      accept="image/*"
      multiple
      tabindex="-1"
      aria-hidden="true"
      @change="onPickChange"
    />
  </div>
</template>

<script setup lang="ts">
// 文件：packages/markdown-editor/src/MarkdownEditor.vue
// 公共组件：不依赖任何业务代码，复用时整个目录带走即可（含 core / composables / toolbar / styles）。
// 内容是受控的：正文 v-model，模式 v-model:mode；保存、发布等业务动作由页面自己做。
//
// 这个文件只做「组装」——每块能力都在自己的目录里：
//   config.ts              默认工具栏 / 模式 / 下拉选项 / 行前缀正则
//   locales/               一门语言一个文件（language prop 选，texts 可再逐句覆盖）
//     ├── index.ts         语言注册表 / getLocale / registerLocale
//     ├── zh.ts            中文语言包（默认）
//     └── en.ts            英文语言包
//   core/markdown.ts       纯函数（渲染 / 净化 / 字数 / 目录 / 选区计算），不依赖 vue
//   core/htmlToMarkdown.ts 粘贴转换（turndown 懒加载）
//   core/upload.ts         图片占位的插入 / 回填 / 清理（纯函数）
//   composables/useHistory.ts        撤销重做栈 + 连续输入合并 + 回声判定
//   composables/useScrollSync.ts     左右分屏滚动联动 + 锁位去回声
//   composables/useEditorCommands.ts 工具栏动作（算新值与光标，落盘交给这里）
//   toolbar/registry.ts    工具栏注册表（配置数组 → 组件 + props）
//   toolbar/icons.ts       图标集（24×24 线性描边）
//   toolbar/Toolbar*.vue   四个工具栏小部件
//   styles/editor.css      外壳样式（仍是 scoped，只是挪出组件）
// 这样读「撤销逻辑」不必在八百多行里翻，改「按钮」也不必碰渲染。
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { PropType } from 'vue'
import './styles/markdown.css'
import ToolbarButton from './toolbar/ToolbarButton.vue'
import ToolbarSelect from './toolbar/ToolbarSelect.vue'
import ToolbarColor from './toolbar/ToolbarColor.vue'
import ToolbarSep from './toolbar/ToolbarSep.vue'
import { ICONS } from './toolbar/icons'
import {
  renderMarkdown, countWords, canSanitize, continueList, indentSelection, detectActive,
} from './core/markdown'
import type { EditorActiveState } from './core/markdown'
import { readableTextColor } from './core/color'
import { DEFAULT_SHORTCUTS, hitShortcut } from './core/shortcuts'
import { htmlToMarkdown, looksLikeRichHtml, insertMarkdownAt } from './core/htmlToMarkdown'
import {
  insertImagePlaceholder, replaceImagePlaceholder, removeImagePlaceholder,
  findImagePlaceholder, defaultImageAlt,
} from './core/upload'
import { DEFAULT_TOOLBAR, MODES, VALID_MODES } from './config'
import { getLocale } from './locales'
import { useHistory } from './composables/useHistory'
import { useScrollSync } from './composables/useScrollSync'
import { useEditorCommands } from './composables/useEditorCommands'
import { createToolBuilders, resolveTools } from './toolbar/registry'
import type {
  MarkdownEditorLanguage, MarkdownEditorMode, MarkdownEditorShortcuts, MarkdownEditorTexts,
  MarkdownEditorUploadImage, MarkdownRenderOptions, ResolvedTexts, ToolbarItem,
} from './types'

// 组件名：DevTools 面板与 KeepAlive 的 include 都靠它认人
defineOptions({ name: 'MarkdownEditor' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  // 'edit' | 'split' | 'preview'；不传时组件用内部状态（不受控也能用）
  mode: { type: String as PropType<MarkdownEditorMode>, default: undefined },
  // 高度 / 宽度：数字按 px 处理，也可以直接给 CSS 长度
  height: { type: [String, Number] as PropType<string | number>, default: '58vh' },
  width: { type: [String, Number] as PropType<string | number>, default: '100%' },
  // 占位文案：不传 / 传 null 用内置默认，传 '' 表示「就是不要占位文案」
  placeholder: { type: String as PropType<string | null>, default: null },
  readonly: { type: Boolean, default: false },
  showToolbar: { type: Boolean, default: true },
  showStatus: { type: Boolean, default: true },
  showMode: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: true },
  // 主题：light / dark / auto（跟随系统 prefers-color-scheme）。
  // 只覆盖 CSS 变量，组件结构不变；宿主也可直接在自己的 CSS 里盖 --md-* 换肤。
  theme: {
    type: String as PropType<'light' | 'dark' | 'auto'>,
    default: 'light',
    validator: (v: string) => ['light', 'dark', 'auto'].includes(v),
  },
  // 标题 id 前缀：同页面两个编辑器预览同一篇文档时传不同值，避免重复 id
  idPrefix: { type: String, default: '' },
  // 界面语言：'zh'（默认）/ 'en'，或 registerLocale 注册过的语言码。
  // 换语言只要这一个 prop，不需要知道组件内部有哪些文案字段。
  language: { type: String as PropType<MarkdownEditorLanguage>, default: 'zh' },
  // 粘贴富文本时是否把剪贴板 HTML 转成 Markdown（turndown 动态加载，不影响首屏）
  pasteHtml: { type: Boolean, default: true },
  // 预览渲染防抖（ms）：长文档每次按键都重跑 marked + DOMPurify 会明显卡顿。
  // 字数 / 行数是纯计算，保持实时；只有预览 HTML 延迟。传 0 关闭防抖（测试用）。
  renderDelay: { type: Number, default: 120 },
  // 撤销合并窗口（ms）：连续打字落在窗口内算一步撤销，传 0 逐字撤销。
  // 数值合理性交给 useHistory 兜底（负数 / NaN 退回默认 800），这里不重复校验。
  undoMergeWindow: { type: Number, default: 800 },
  // 字数上限：只做提示与超限标记，不截断输入——截断会吞字，也会让 v-model 与光标错位。
  // 0 / 负数 / NaN 一律按「不限制」处理，判断集中在 wordLimit 这个 computed 里。
  maxLength: { type: Number, default: 0 },
  // 全屏按钮：默认显示。关掉它，工具栏就回到「只有格式工具 + 模式切换」的老样子。
  showFullscreen: { type: Boolean, default: true },
  // 全屏状态：默认 undefined = 不受控（组件内部维护）。
  // 显式写 default: undefined 很关键——Boolean prop 缺省会被 Vue 归一化成 false，
  // 那样「没传」和「传了 false」就分不开，受控 / 不受控也就无从判断。
  fullscreen: { type: Boolean, default: undefined },
  // 快捷键：不传用默认 mod+b/i/k/e；传对象只覆盖写到的动作；传 false 全关。
  // 类型里 Boolean 与 Object 并存是为了让 `:shortcuts="false"` 能直接落到 false。
  // 改了键位，工具栏悬浮提示里的「(Ctrl+B)」会跟着变（见 toolbar/registry.ts 的 T）。
  shortcuts: {
    type: [Object, Boolean] as PropType<MarkdownEditorShortcuts>,
    default: () => ({}),
  },
  // 品牌主色：传了就替掉内置的 sage 绿。空字符串表示「用内置配色」，不要把空值写进变量——
  // 那会让 --md-accent 变成空值，var() 全部失效。
  accentColor: { type: String, default: '' },
  // 工具栏配置：组名（见 toolbar/registry.ts 的 GROUPS）、单个工具 id、'sep'、自定义按钮对象，按数组顺序渲染
  toolbar: { type: Array as PropType<ToolbarItem[]>, default: () => DEFAULT_TOOLBAR },
  // 逐句微调：优先级高于 language，只传想改的那几句。整套换语言用 language
  texts: { type: Object as PropType<MarkdownEditorTexts>, default: () => ({}) },
  // 图片上传适配器：不传就只把文件抛给宿主（paste-image / drop-image），传了由组件管占位与回填。
  // 用 PropType<Function> 而不是 type: Function，是为了让 props.uploadImage 保留完整签名。
  uploadImage: {
    type: Function as PropType<MarkdownEditorUploadImage>,
    default: undefined,
  },
  // 渲染选项，透传给 renderMarkdown：{ extensions, renderer, markedOptions, sanitize }
  // 要挂 mermaid / 脚注 / @提及 这类 marked 扩展时传这里，不必改组件源码。
  // 注意对象要保持引用稳定（别在模板里现建字面量），否则每次渲染都会重建 marked 实例。
  renderOptions: { type: Object as PropType<MarkdownRenderOptions>, default: () => ({}) },
})
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', mode: MarkdownEditorMode): void
  (e: 'update:fullscreen', value: boolean): void
  (e: 'change', value: string): void
  (e: 'paste-image', files: File[]): void
  (e: 'drop-image', files: File[]): void
  (e: 'upload-error', file: File, error: unknown): void
}>()

// 文案解析顺序：texts（逐句覆盖）> language 对应的语言包 > 中文默认。
// language 没注册过时 getLocale 会退回中文，界面上不会出现空白文案。
// tools / snippets 是两张表，浅合并会把没提到的键抹成 undefined，所以各单独合并一层。
const t = computed<ResolvedTexts>(() => {
  const base = getLocale(props.language)
  return {
    ...base,
    ...props.texts,
    tools: { ...base.tools, ...props.texts?.tools },
    snippets: { ...base.snippets, ...props.texts?.snippets },
  }
})
const cssWidth = computed(() => (typeof props.width === 'number' ? `${props.width}px` : props.width))
const cssHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height))

// 品牌主色落到内联变量：内联样式的优先级高于任何选择器，所以亮色 / 深色 / 跟随系统
// 三种主题一次覆盖到位——外部写 `.md-editor { --md-accent: … }` 会被组件的 scoped
// 属性选择器（`.md-editor[data-v-xxx]`）压住，只能靠 !important，那不该是使用方的日常。
// 反白字交给 readableTextColor 按对比度挑：品牌色是浅色时自动换深字，不至于白字贴浅底。
const accentStyle = computed<Record<string, string> | null>(() => {
  const c = (props.accentColor || '').trim()
  if (!c) return null
  return {
    '--md-accent': c,
    '--md-accent-contrast': readableTextColor(c),
  }
})

const ta = ref<HTMLTextAreaElement | null>(null)
const previewRef = ref<HTMLElement | null>(null)

// ---- 全屏：受控（v-model:fullscreen）优先，未绑定则由内部状态维护 ----
// 与 mode 同一套路：只有 undefined 才算「没传」，显式 false 表示「就是不展开」。
const innerFullscreen = ref(false)
const isFullscreen = computed(() => (
  props.fullscreen === undefined ? innerFullscreen.value : props.fullscreen
))
function setFullscreen(v: boolean) {
  if (props.fullscreen === undefined) innerFullscreen.value = v
  emit('update:fullscreen', v)
}
function toggleFullscreen() { setFullscreen(!isFullscreen.value) }

// 全屏时宽高交给 inset，不再写行内值：否则 style="height:420px" 会把铺满视口的容器压扁。
const rootSizeStyle = computed(() => (isFullscreen.value ? undefined : { width: cssWidth.value }))

// 三个副作用挂在「有效状态」上，而不是点击处：受控模式下父组件改 prop 也要跟着生效。
// 浏览器环境判断是必须的——SSR 里没有 document / window。
let bodyOverflow: string | null = null
function lockBodyScroll() {
  if (typeof document === 'undefined' || bodyOverflow !== null) return
  bodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}
function unlockBodyScroll() {
  if (typeof document === 'undefined' || bodyOverflow === null) return
  document.body.style.overflow = bodyOverflow
  bodyOverflow = null
}
function onEscExit(e: KeyboardEvent) {
  if (e.key === 'Escape') setFullscreen(false)
}
let firstFullscreenRun = true
watch(isFullscreen, (v) => {
  if (typeof window === 'undefined') return
  if (v) {
    lockBodyScroll()
    window.addEventListener('keydown', onEscExit)
    // 首屏就是全屏时不抢焦点：页面刚打开就把光标拽进文本框，其他控件都没法用键盘到达
    if (!firstFullscreenRun) nextTick(() => ta.value?.focus({ preventScroll: true }))
  } else {
    unlockBodyScroll()
    window.removeEventListener('keydown', onEscExit)
  }
  firstFullscreenRun = false
}, { immediate: true })
onBeforeUnmount(() => {
  disposed = true
  unlockBodyScroll()
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onEscExit)
})

// ---- 显示模式：受控（父组件 v-model:mode）优先，未绑定则用内部状态 ----
// 非法值一律退到 split——传错一个字符串不该让两个面板同时显示、single 类也失效。
function normalizeMode(v: string | undefined): MarkdownEditorMode | '' {
  return VALID_MODES.includes(v as MarkdownEditorMode) ? (v as MarkdownEditorMode) : ''
}
const innerMode = ref<MarkdownEditorMode>(normalizeMode(props.mode) || 'split')
const currentMode = computed<MarkdownEditorMode>({
  get: () => normalizeMode(props.mode) || (props.mode === undefined ? innerMode.value : 'split'),
  set: (v) => {
    const next = normalizeMode(v)
    if (!next) return
    if (props.mode !== undefined) emit('update:mode', next)
    else innerMode.value = next
  },
})
watch(() => props.mode, (v) => { if (v === undefined) innerMode.value = 'split' })
function setMode(v: MarkdownEditorMode) { currentMode.value = v }

// ---- 渲染：marked + DOMPurify，带 SSR 守卫与预览防抖 ----
// DOMPurify 需要 DOM：纯 node SSR 环境先给空串、挂载后再算，
// 避免服务端渲染直接抛「需要 DOM 环境」。判断函数见 core/markdown.ts 的 canSanitize。
const domReady = ref(canSanitize())
onMounted(() => { domReady.value = true })
// idPrefix 并进 opts 而不是新开参数：marked 实例缓存按 options 引用命中，
// 这里用 computed 保证「只有 renderOptions / idPrefix 真的变了」才换对象。
const renderOpts = computed<MarkdownRenderOptions>(() => (
  props.idPrefix ? { ...props.renderOptions, idPrefix: props.idPrefix } : props.renderOptions
))
// 两套 HTML：rawHtml 同步算（getHtml() 拿到的一定是最新），displayHtml 防抖后喂给预览。
// 只防抖预览、不防抖字数 / 行数——那些是纯计算，实时更新才符合「状态栏」的语义。
const rawHtml = computed(() => (domReady.value ? renderMarkdown(props.modelValue, renderOpts.value) : ''))
const displayHtml = ref('')
let renderTimer: ReturnType<typeof setTimeout> | null = null
watch(rawHtml, (v) => {
  if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }
  // 首屏 / 内容被清空时立刻渲染，别让用户先看到一块空白
  if (!displayHtml.value || props.renderDelay <= 0) { displayHtml.value = v; return }
  renderTimer = setTimeout(() => { displayHtml.value = v; renderTimer = null }, props.renderDelay)
}, { immediate: true })
onBeforeUnmount(() => { if (renderTimer) clearTimeout(renderTimer) })

const words = computed(() => countWords(props.modelValue))
const lineCount = computed(() => (props.modelValue ? props.modelValue.split('\n').length : 1))

// 字数上限：0 / 负数 / NaN 一律按「不限制」处理。判断只在这里做一次，
// 状态栏文案与根节点的 data-over-limit 共用同一个结果，不会出现「显示超了、样式没变」。
const wordLimit = computed(() => {
  const n = Number(props.maxLength)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
})
const overLimit = computed(() => wordLimit.value > 0 && words.value > wordLimit.value)

// ---- 滚动联动：左右分屏按比例跟随，程序化滚动的回声靠锁位吃掉 ----
const { unlock, fromSource: onTextScroll, fromPreview: onPreviewScroll, keepRatio } = useScrollSync({
  source: () => ta.value,
  preview: () => previewRef.value,
})
// 内容变化会重建预览 DOM，可能把 preview 的 scrollTop 冲回 0
watch(displayHtml, () => { void keepRatio(previewRef.value) })

// ---- 光标行列（状态栏）+ 工具栏激活态 ----
const cursorLine = ref(1)
const cursorCol = ref(1)
const active = shallowRef<EditorActiveState>(detectActive('', 0, 0))

// 反推「光标处已经是什么」的逻辑在 core/markdown.ts 的 detectActive 里（纯函数，可单测）。
// 不做这个，用户就不知道自己在不在加粗里，标题下拉也永远显示「正文」。
function syncCursor() {
  const el = ta.value
  if (!el) return
  const before = el.value.slice(0, el.selectionStart)
  const lines = before.split('\n')
  cursorLine.value = lines.length
  cursorCol.value = lines[lines.length - 1].length + 1
  active.value = detectActive(el.value, el.selectionStart, el.selectionEnd)
}

// ---- 受控值写入：textarea 不做 :value 绑定，统一由这里写 ----
// 为什么不用 :value="modelValue"：那样 Vue 的 patch 会在中文输入法拼字过程中回写
// el.value，把正在组字的内容打断（Android / 部分 Chromium 上很明显）。
// 自己写、自己判 composing，才控制得住。
let composing = false
function setDomValue(v: string) {
  const el = ta.value
  if (el && el.value !== v) el.value = v
}
onMounted(() => {
  setDomValue(props.modelValue)
  // 浏览器给 textarea 赋值后，光标默认落在文末。于是首屏的标题下拉会显示「正文」，
  // 哪怕用户看到的第一行明明是「# 标题」——激活态没错，是初始光标位置不对。
  // 初始化时把光标放回开头，让首屏状态和第一屏内容一致；用户点哪儿就仍然到哪儿。
  const el = ta.value
  if (el && el.selectionStart === el.value.length) el.setSelectionRange(0, 0)
  syncCursor() // 初始化工具栏激活态（首屏光标的行内 / 行级状态）
})
function onCompositionEnd(e: Event) {
  composing = false
  onInput(e)
  flushSettled() // 拼字期间回来的上传结果，等这里才落盘
}

// ---- 撤销 / 重做：栈在 useHistory 里，这里只管「取到目标值后怎么落到界面」----
// 合并窗口传 getter 而不是值：宿主运行中改 undoMergeWindow 要立刻生效，
// 而 useHistory 只在 setup 里建一次。
const history = useHistory({
  initial: props.modelValue,
  mergeWindow: () => props.undoMergeWindow,
})
const { canUndo, canRedo } = history

function emitValue(v: string) {
  history.expectEcho(v)
  emit('update:modelValue', v)
  emit('change', v)
}

// 所有改动统一走这里：记录历史 + 写 DOM + emit + 还原光标（且保持视口不跳底）
function commit(v: string, selStart: number, selEnd: number) {
  history.record(v, { force: true })
  setDomValue(v)
  emitValue(v)
  restore(ta.value, selStart, selEnd)
}

function onInput(e: Event) {
  const v = (e.target as HTMLTextAreaElement).value
  history.record(v)
  emitValue(v)
  syncCursor()
}

// 外部改动（如「恢复示例」）同步基线并清空历史；自己 emit 出去的回声不算外部改动
watch(() => props.modelValue, (nv) => {
  if (history.isEcho(nv)) return // DOM 已经是这个值，历史栈也刚记过
  if (!composing) setDomValue(nv)
  history.reset(nv)
  nextTick(syncCursor) // 外部换了内容，激活态也得跟着重算
})

function undo() {
  const prev = history.undo()
  if (prev === null) return
  commit(prev, prev.length, prev.length)
  focusEnd()
}
function redo() {
  const next = history.redo()
  if (next === null) return
  commit(next, next.length, next.length)
  focusEnd()
}

function focusEnd() {
  nextTick(() => {
    const el = ta.value
    if (!el) return
    const st = el.scrollTop
    el.focus({ preventScroll: true })
    const p = el.value.length
    el.setSelectionRange(p, p)
    el.scrollTop = st // 保持视口位置，不跳到底部
    syncCursor()
  })
}
function restore(el: HTMLTextAreaElement | null, start: number, end: number) {
  if (!el) return
  const st = el.scrollTop
  requestAnimationFrame(() => {
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(start, end)
    el.scrollTop = st // 保持视口位置，避免插入后滚动条跳底
    syncCursor()
  })
}

// ---- 工具栏动作：全部委托给命令层，这里只提供「当前值 / 选区 / 落盘方式」----
const commands = useEditorCommands({
  getValue: () => props.modelValue,
  getSelection: () => {
    const el = ta.value
    if (!el) return null
    return { start: el.selectionStart, end: el.selectionEnd }
  },
  commit,
})

// ---- 图片：有适配器就管占位与回填，没有就只把文件交出去 ----
// 组件始终不碰网络：地址从哪来、要不要鉴权与压缩，全由 uploadImage 决定。
// 它负责的只是「占位钉在原位 → 完成后原地替换」，这一段和上传实现无关。

/** 待上传张数：只用于状态栏提示，不参与正文逻辑 */
const pendingUploads = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
let uploadSeq = 0
/** 卸载后仍在飞的请求：回来时不要再写 DOM、也不要再 emit */
let disposed = false

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list || []).filter((f) => f && /^image\//.test(f.type))
}

/** 打开系统文件选择框；返回 false 表示当前没有可用的上传通道 */
function pickImage(): boolean {
  if (!props.uploadImage || props.readonly) return false
  if (typeof document === 'undefined' || !fileInput.value) return false
  fileInput.value.click()
  return true
}

function onPickChange(e: Event) {
  const el = e.target as HTMLInputElement
  acceptImages(Array.from(el.files || []), 'pick')
  // 清空 value：同一个文件连选两次也要能再次触发 change
  el.value = ''
}

/**
 * 三条入口（粘贴 / 拖入 / 选择文件）在这里汇合，只有一个分叉：
 * 没配适配器 → 抛给宿主；配了 → 组件接管占位与回填。
 */
function acceptImages(files: File[], source: 'paste' | 'drop' | 'pick') {
  const images = imageFiles(files)
  if (!images.length) return
  if (!props.uploadImage) {
    // 'pick' 走不到这里：pickImage 在没有适配器时就直接返回 false，选择框不会被打开
    if (source === 'paste') emit('paste-image', images)
    else if (source === 'drop') emit('drop-image', images)
    return
  }
  void startUploads(images)
}

/** 当前选区；拿不到 DOM 时退到文末（例如首屏就触发了上传） */
function currentSelection(): { start: number; end: number } {
  const el = ta.value
  const at = props.modelValue.length
  if (!el) return { start: at, end: at }
  return { start: el.selectionStart, end: el.selectionEnd }
}

/**
 * 先把所有占位一次排好，再并发上传。
 * 逐张 await 的话，第二张的占位会被排到用户新打的字后面——上传期间用户还在写。
 */
async function startUploads(files: File[]) {
  // 预览态没有可用光标，占位会插到上次的位置；先切回分屏，和 insert() 的处理一致
  if (currentMode.value === 'preview') setMode('split')
  const sel = currentSelection()
  let value = props.modelValue
  let caret = sel.start
  const jobs = files.map((file) => {
    // token 只需在同一篇文档里唯一：回填时按它在正文里定位，跨实例撞车没有影响
    const token = `u${++uploadSeq}`
    const alt = defaultImageAlt(file.name) || t.value.snippets.image
    const r = insertImagePlaceholder(value, caret, alt, token)
    value = r.value
    caret = r.selectionEnd
    return { file, token, alt }
  })
  // 一次 commit：多张图一起选时只占一格撤销，而不是插几张就有几步历史
  commit(value, caret, caret)
  pendingUploads.value += jobs.length
  await Promise.all(jobs.map(runUpload))
}

interface UploadJob {
  token: string
  file: File
  url?: string
  alt?: string
  error?: unknown
}

async function runUpload({ file, token, alt }: { file: File; token: string; alt: string }) {
  const adapter = props.uploadImage
  if (!adapter) return
  try {
    const res = await adapter(file)
    const url = typeof res === 'string' ? res : res?.url || ''
    if (!url.trim()) throw new Error('uploadImage 返回了空地址')
    const finalAlt = (typeof res === 'string' ? '' : res?.alt || '').trim() || alt
    settle({ token, file, url, alt: finalAlt })
  } catch (error) {
    settle({ token, file, error })
  } finally {
    pendingUploads.value = Math.max(0, pendingUploads.value - 1)
  }
}

// 输入法拼字期间不能整段重写 textarea（会打断组字），先攒着，等 compositionend 再落。
// 攒的是「结果」而不是「新正文」：落盘时按 token 现找，期间用户改了什么都不会被覆盖。
const settledJobs: UploadJob[] = []

function settle(job: UploadJob) {
  if (disposed) return
  if (composing) { settledJobs.push(job); return }
  applyUpload(job)
}

function flushSettled() {
  if (!settledJobs.length) return
  for (const job of settledJobs.splice(0)) applyUpload(job)
}

function applyUpload({ token, file, url, alt, error }: UploadJob) {
  const before = props.modelValue
  const range = findImagePlaceholder(before, token)
  // 占位被撤销或删掉了：不再硬插，否则图片会出现在毫不相干的位置
  if (!range) return
  const next = error === undefined
    ? replaceImagePlaceholder(before, token, url || '', alt || '')
    : removeImagePlaceholder(before, token)
  if (next === null) return
  applySilently(next, range)
  if (error !== undefined) emit('upload-error', file, error)
}

/**
 * 静默落盘：只改正文，不抢焦点。
 * 上传是后台完成的，此刻用户可能正在别处打字，把焦点抢回编辑区是最惹人烦的一种「贴心」。
 */
function applySilently(next: string, range: { start: number; end: number }) {
  const el = ta.value
  const selStart = el?.selectionStart ?? null
  const selEnd = el?.selectionEnd ?? null
  const delta = next.length - props.modelValue.length // 必须在 emit 之前算，emit 会同步父组件的值
  history.record(next, { force: true })
  setDomValue(next)
  emitValue(next)
  if (!el || selStart === null || selEnd === null) return
  // 占位之前的位点不动；之后的跟着位移；落在占位内部的收拢到区间开头
  const map = (p: number) => (
    p <= range.start ? p : p >= range.end ? Math.max(range.start, p + delta) : range.start
  )
  el.setSelectionRange(map(selStart), map(selEnd))
  syncCursor()
}

function applyPaste(text: string, s: number, e: number) {
  const { value, selectionStart, selectionEnd } = insertMarkdownAt(props.modelValue, s, e, text)
  commit(value, selectionStart, selectionEnd)
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly) return
  const cd = e.clipboardData
  if (!cd) return

  // 1) 剪贴板里是图片（截图 / 复制的图）：阻止默认，走上传通道
  const images = imageFiles(cd.files)
  if (images.length) {
    e.preventDefault()
    acceptImages(images, 'paste')
    return
  }
  // 部分应用只往 items 里放图片、files 为空：这里兜一层，否则会退化成「粘贴了什么都没发生」
  const itemFiles = Array.from(cd.items || [])
    .filter((it) => it.kind === 'file' && /^image\//.test(it.type))
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f)
  if (itemFiles.length) {
    e.preventDefault()
    acceptImages(itemFiles, 'paste')
    return
  }

  // 2) 富文本：先转 Markdown 再插入
  if (!props.pasteHtml) return
  // 名字带 clip 前缀：上面有个 rawHtml（预览 HTML 的 computed），别让两个 rawHtml 撞车
  const clipHtml = cd.getData('text/html')
  if (!looksLikeRichHtml(clipHtml)) return // 纯文本 / 单层 span：交给浏览器默认粘贴

  e.preventDefault()
  const el = ta.value
  const s = el ? el.selectionStart : props.modelValue.length
  const end = el ? el.selectionEnd : s
  const plain = cd.getData('text/plain')
  void htmlToMarkdown(clipHtml).then((md) => {
    // 转换失败（没装 turndown / 运行时异常）就退回纯文本，绝不让粘贴变成什么都没发生
    if (md === null) {
      if (plain) applyPaste(plain, s, end)
      return
    }
    if (md) applyPaste(md, s, end)
  })
}

function onDrop(e: DragEvent) {
  if (props.readonly) return
  const images = imageFiles(e.dataTransfer?.files)
  if (!images.length) return
  // 拖图进编辑区：拦下来，避免浏览器把图片当成文件导航走
  e.preventDefault()
  acceptImages(images, 'drop')
}

// ---- 键盘：撤销重做 + 可配置的格式快捷键 + Tab 缩进 + 回车续列表 ----
// 手不离键盘是「像编辑器」和「像个多行文本框」的分水岭。

/**
 * 当前生效的键位表。
 * 宿主传 false 就整体关掉；传对象则覆盖「写到的」动作，没写的仍落到默认值——
 * 只改一个键时不需要把四个都抄一遍。
 */
const shortcutMap = computed<Record<string, string | false>>(() => {
  const user = props.shortcuts
  if (user === false) return {}
  return { ...DEFAULT_SHORTCUTS, ...(user || {}) } as Record<string, string | false>
})

function onKeydown(e: KeyboardEvent) {
  if (props.readonly) return
  // 输入法拼字中：Enter / 方向键在选候选词，一律不接管
  if (e.isComposing || composing) return

  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()

  // 撤销 / 重做不进配置：它们要同步 useHistory 的栈，
  // 让浏览器原生撤销接管会和这份栈错位（撤销一次跳两格）。
  if (mod) {
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
  }

  const action = hitShortcut(e, shortcutMap.value)
  if (action === 'bold') {
    e.preventDefault(); commands.wrap('**', t.value.snippets.bold); return
  }
  if (action === 'italic') {
    e.preventDefault(); commands.wrap('*', t.value.snippets.italic); return
  }
  if (action === 'link') {
    e.preventDefault(); commands.link(t.value.snippets.link); return
  }
  if (action === 'inlineCode') {
    e.preventDefault(); commands.wrap('`', t.value.snippets.inlineCode); return
  }

  // 其余 Ctrl / ⌘ 组合不拦：复制、粘贴、开新标签页这些都该留给浏览器
  if (mod) return

  // Tab 必须拦下来：不拦的话焦点直接跳到页面上下一个控件，编辑到一半就飞了
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = ta.value
    if (!el) return
    const r = indentSelection(props.modelValue, el.selectionStart, el.selectionEnd, e.shiftKey)
    commit(r.value, r.selectionStart, r.selectionEnd)
    return
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    const el = ta.value
    if (!el) return
    const r = continueList(props.modelValue, el.selectionStart)
    if (r) { e.preventDefault(); commit(r.value, r.selectionStart, r.selectionEnd) }
  }
}

// ---- 工具栏：配置数组 → 组件 + props（注册表在 toolbar/registry.ts）----
const visibleTools = computed(() => {
  const builders = createToolBuilders({
    components: { Button: ToolbarButton, Select: ToolbarSelect, Color: ToolbarColor, Sep: ToolbarSep },
    commands: { ...commands, undo, redo },
    canUndo: () => canUndo.value,
    canRedo: () => canRedo.value,
    active: () => active.value,
    texts: () => t.value,
    // 提示里的「(Ctrl+B)」由这里算：宿主改了键位，悬浮提示跟着变
    shortcuts: () => shortcutMap.value,
    // 配了适配器，图片按钮就从「插模板」变成「选文件上传」；没配保持原行为
    openImagePicker: props.uploadImage ? pickImage : undefined,
  })
  return resolveTools(props.toolbar, { builders, button: ToolbarButton, sep: ToolbarSep })
})

// ---- 暴露给父组件的方法 ----
function focus() { ta.value?.focus() }
// getHtml 返回同步算出的最新 HTML（不走防抖），避免「刚输入的最后一笔拿不到」
function getHtml() { return rawHtml.value }
function insert(text: string): boolean {
  if (props.readonly) return false // 只读态不写入，返回 false 方便调用方判断
  // 预览态下没有可用光标，先切回分屏再插，否则会插到上次的旧位置
  if (currentMode.value === 'preview') setMode('split')
  const el = ta.value
  const s = el ? el.selectionStart : props.modelValue.length
  const next = props.modelValue.slice(0, s) + text + props.modelValue.slice(s)
  commit(next, s + text.length, s + text.length)
  return true
}
defineExpose({ focus, getHtml, insert, undo, redo, setMode, pickImage })
</script>

<style scoped src="./styles/editor.css"></style>
