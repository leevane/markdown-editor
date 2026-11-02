// 文件：packages/markdown-editor/src/toolbar/icons.ts
// 统一图标集：24×24 网格、线性描边、currentColor。
// 每个值是 <svg> 的内层标记，供 <svg v-html> 渲染；需要实心的点用 fill + stroke="none"。
export const ICONS: Record<string, string> = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  quote: '<path d="M5 5v14"/><path d="M11 8h8"/><path d="M11 12h8"/><path d="M11 16h5"/>',
  ul: '<circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none"/><path d="M10 7h9"/><path d="M10 12h9"/><path d="M10 17h9"/>',
  ol: '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  hr: '<path d="M4 12h16"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="20" cy="12" r="1" fill="currentColor" stroke="none"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M10 10v10"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9"/><path d="M14 20H5"/><path d="M15 4 9 20"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/>',
  inlineCode: '<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>',
  codeBlock: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m10 9-3 3 3 3"/><path d="m14 9 3 3-3 3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-4.5-4.5L7 21"/>',
  textColor: '<path d="M6 19 12 5l6 14"/><path d="M8.6 14h6.8"/>',
  highlight: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  // 全屏 / 退出：四角朝外展开、朝内收拢，与工具栏其余图标同为 24×24 线性描边
  fullscreen: '<path d="M9 4H5a1 1 0 0 0-1 1v4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M15 20h4a1 1 0 0 0 1-1v-4"/>',
  fullscreenExit: '<path d="M9 4v4a1 1 0 0 1-1 1H4"/><path d="M15 4v4a1 1 0 0 0 1 1h4"/><path d="M9 20v-4a1 1 0 0 0-1-1H4"/><path d="M15 20v-4a1 1 0 0 1 1-1h4"/>',
}
