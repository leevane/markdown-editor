<template>
  <label class="md-color" :title="title">
    <svg
      class="md-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="icon"
    ></svg>
    <span class="md-color-bar" :style="{ background: modelValue }"></span>
    <input
      type="color"
      :value="modelValue"
      :aria-label="title"
      @change="onPick"
    />
  </label>
</template>

<script setup lang="ts">
// 文件：packages/markdown-editor/src/toolbar/ToolbarColor.vue
// 取色工具：图标 + 底部色条，点击整块打开取色器（原生 input 透明覆盖）
import { computed } from 'vue'
import type { PropType } from 'vue'
import { ICONS } from './icons'

const props = defineProps({
  title: { type: String, default: '' },
  modelValue: { type: String, default: '#000000' },
  kind: { type: String as PropType<'text' | 'bg'>, default: 'text' },
})
const emit = defineEmits<{ (e: 'change', value: string): void }>()

// 模板里直接写 $event.target.value 在 TS 下会报两条：
// target 可能为 null；EventTarget 上没有 value。抽成方法后可以安全断言。
function onPick(e: Event) {
  emit('change', (e.target as HTMLInputElement).value)
}

const icon = computed(() => (props.kind === 'bg' ? ICONS.highlight : ICONS.textColor))
</script>

<style scoped>
.md-color {
  position: relative; display: inline-flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  width: 30px; height: 28px; padding: 3px 0 3px;
  border: 1px solid transparent; border-radius: 5px;
  background: transparent; color: var(--md-text, #4b5563); cursor: pointer;
  transition: background .12s, color .12s;
}
.md-color:hover { background: var(--md-hover, #eceff3); color: var(--md-text-strong, #111827); }
/* 取色器的 input 是透明覆盖层，焦点描边只能挂在 label 上（focus-within） */
.md-color:focus-within { outline: 2px solid var(--md-accent, #46ba86); outline-offset: 1px; }
.md-icon { width: 15px; height: 15px; display: block; flex: none; }
.md-color-bar {
  width: 16px; height: 3px; border-radius: 1px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .08);
}
.md-color input {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0; border: none; padding: 0; cursor: pointer;
}
</style>
