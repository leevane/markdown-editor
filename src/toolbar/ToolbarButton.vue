<template>
  <button
    class="md-tb"
    :class="{ on: pressed === true }"
    type="button"
    :title="title"
    :aria-label="title"
    :aria-pressed="pressed === null ? undefined : pressed"
    :disabled="disabled"
    @click="$emit('action')"
  >
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
  </button>
</template>

<script setup lang="ts">
// 文件：packages/markdown-editor/src/toolbar/ToolbarButton.vue
// 工具栏通用按钮：SVG 图标 + 提示 + 禁用态 + 激活态，点击只上报 action，动作由主组件注入
import type { PropType } from 'vue'

defineProps({
  icon: { type: String, required: true }, // SVG 内层标记（内部常量，非用户输入）
  title: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  // 激活态：null = 这不是开关型按钮（不输出 aria-pressed），true/false = 开关型
  pressed: { type: Boolean as PropType<boolean | null>, default: null },
})
defineEmits<{ (e: 'action'): void }>()
</script>

<style scoped>
.md-icon { width: 16px; height: 16px; display: block; flex: none; }
</style>
