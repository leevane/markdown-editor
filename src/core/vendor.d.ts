// 文件：packages/markdown-editor/src/core/vendor.d.ts
// turndown 官方没有自带类型，社区包 @types/turndown 又不一定装。
// 这里只声明我们真正用到的那一小块接口：够 typecheck 用，也不用为了几个方法
// 给整个项目加一个类型依赖（组件是要被别的项目拷走的，依赖越少越好）。

declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx'
    hr?: string
    bulletListMarker?: '-' | '+' | '*'
    codeBlockStyle?: 'indented' | 'fenced'
    emDelimiter?: string
    strongDelimiter?: string
    linkStyle?: 'inlined' | 'referenced'
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions)
    use(plugin: unknown): this
    addRule(key: string, rule: Record<string, unknown>): this
    turndown(html: string): string
  }
}

declare module 'turndown-plugin-gfm' {
  /** GFM 插件：表格 / 删除线 / 任务列表 */
  export const gfm: unknown
}
