// 文件：packages/markdown-editor/src/core/color.ts
// 颜色计算：只做「给了背景色，前景该用白还是黑」这一件事。
//
// 为什么需要它：激活态按钮是「实底 + 反白字」。品牌色一旦是浅色（黄 / 浅蓝 / 白），
// 白字与背景的对比度会掉到 1.5:1 以下，等于看不见。这里按 WCAG 的相对亮度算出
// 两种候选字色的对比度，取高的那个，不靠人肉判断。
//
// 纯函数，不依赖 vue / DOM，可直接被 s78-check.mjs 在 node 里跑。

export type RGB = readonly [number, number, number]

/** 解析 #rgb / #rrggbb / rgb() / rgba()；解析不了返回 null（调用方据此用默认值） */
export function parseColor(input: string): RGB | null {
  const s = input.trim()
  if (!s) return null

  if (s.startsWith('#')) {
    const hex = s.slice(1)
    // #abc 简写要展开成 #aabbcc，否则每两位一组会错位
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b] = hex.slice(0, 3).split('')
      return [
        parseInt(r + r, 16),
        parseInt(g + g, 16),
        parseInt(b + b, 16),
      ]
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ]
    }
    return null
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (!m) return null
  // 兼容 `rgb(1, 2, 3)` 与 `rgb(1 2 3 / 50%)` 两种写法：先按逗号或空格切开
  const parts = m[1].split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null
  const nums = parts.slice(0, 3).map((p) => (p.endsWith('%')
    ? Math.round((parseFloat(p) / 100) * 255)
    : parseFloat(p)))
  if (nums.some((n) => Number.isNaN(n))) return null
  return nums.map((n) => Math.min(255, Math.max(0, Math.round(n)))) as unknown as RGB
}

/** WCAG 相对亮度：先把 sRGB 分量线性化，再按 0.2126 / 0.7152 / 0.0722 加权 */
export function relativeLuminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** 两色的对比度（1:1 到 21:1）。顺序无关，内部会先排大小 */
export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export interface ReadableTextOptions {
  /** 浅底上用的深色字，默认 #111827 */
  dark?: string
  /** 深底上用的浅色字，默认 #ffffff */
  light?: string
  /** 解析失败（比如传了 CSS 命名色）时用哪个，默认 light */
  fallback?: string
  /**
   * 白字的最低可接受对比度，低于它才换深字，默认 2.4。
   * 这个数字看着低，是有意的：
   *   · 实底按钮配白字是通用观感，能不改就不改——纯按「谁的对比度高」算，
   *     内置绿 #46ba86 会从白字翻成深字（2.43 vs 7.29），一眼就是换了套配色；
   *   · 2.4 是一条「白字开始糊」的线：内置绿刚好 2.43，擦线保留白字；
   *     浅黄 1.67、浅蓝 1.66 会落到线下，自动换深字。
   * 想要严格的 WCAG（小字 4.5 / 大字 3.0）就传 minLight: 4.5，那样大量品牌色都会换深字。
   */
  minLight?: number
}

/**
 * 给定背景色，返回可读性更好的字色。
 * 顺序是「白字能不能用」→「不能用才换深字」，而不是简单比大小：
 * 前者保住默认观感，后者会在很多正常颜色上把按钮变成浅色标签。
 * 传进来的颜色解析不了时返回 fallback（默认白字），保持和改造前的行为一致。
 */
export function readableTextColor(bg: string, opts: ReadableTextOptions = {}): string {
  const c = parseColor(bg)
  if (!c) return opts.fallback ?? opts.light ?? '#ffffff'

  const light = opts.light ?? '#ffffff'
  const dark = opts.dark ?? '#111827'
  const lc = parseColor(light)
  const dc = parseColor(dark)
  // 自定义字色本身写坏了，就退回默认白字，别让按钮变成透明字
  if (!lc || !dc) return '#ffffff'

  const lightRatio = contrastRatio(c, lc)
  if (lightRatio >= (opts.minLight ?? 2.4)) return light

  // 白字已经看不清了：深字只要确实更好就换，未必更好时仍留白字（暗色背景走到这里的情况）
  return contrastRatio(c, dc) > lightRatio ? dark : light
}
