<template>
  <select class="md-select" :title="title" :aria-label="title" :value="modelValue" @change="onChange">
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>

<script setup lang="ts">
// 文件：packages/markdown-editor/src/toolbar/ToolbarSelect.vue
// 工具栏下拉（标题层级 / 字号）：本质是「动作」不是「状态」，选完自动归位
interface SelectOption {
  value: string | number
  label: string | number
}

// 类型化 props（withDefaults）：不写运行时 type + as 断言，
// 调用方传错值 vue-tsc 直接报错；`type: [String, Number] as …` 那种写法
// 在 TS 里属于「数组断言成函数」，本身就会报 TS2352。
const props = withDefaults(defineProps<{
  title?: string
  options?: SelectOption[]
  modelValue?: string | number
}>(), {
  title: '',
  options: () => [],
  modelValue: '',
})
const emit = defineEmits<{ (e: 'change', value: string): void }>()

function onChange(e: Event) {
  const el = e.target as HTMLSelectElement
  emit('change', el.value) // 先上报，父组件拿到的还是用户选的值
  el.value = String(props.modelValue) // 再归位到默认项
}
</script>
