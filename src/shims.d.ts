// 文件：packages/markdown-editor/src/shims.d.ts
// 给 tsc / vue-tsc 补两类「非 TS 模块」的声明，否则默认配置下会报
//   TS2882: Cannot find module or type declarations for side-effect import of './styles/markdown.css'
//
// 1) *.vue —— SFC。vue-tsc 会真正解析模板，这里的声明只是给
//    「普通 tsc 直接读到 index.ts 的 import」兜底，签名刻意宽松。
// 2) *.css —— 只做副作用导入，没有导出值。

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.css'
