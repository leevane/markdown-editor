// 文件：packages/markdown-editor/src/composables/useScrollSync.ts
// 分屏左右两侧的滚动联动。
//
// 难点不在「按比例跟随」，而在**回声**：程序化写入另一侧 scrollTop 会触发它自己的
// scroll 事件，若再反向写回就变成 A→B→A 的振铃，用户看到的是一条不停抖动的滚动条。
// 这里用「短时锁位」把程序化滚动的回声吃掉：锁定期间忽略被写入那一侧的 scroll，
// 而用户主动按下 / 滚轮时立刻解锁，保证换手操作不粘滞。
import { nextTick } from 'vue'

/** 锁定时长：要盖住「写入 → 布局 → 事件派发」的整条链，120ms 对 60fps 足够宽松 */
const LOCK_MS = 120

export interface ScrollSyncTargets {
  /** 源码编辑区 */
  source: () => HTMLElement | null
  /** 预览区 */
  preview: () => HTMLElement | null
}

export function useScrollSync(targets: ScrollSyncTargets) {
  let lockedEl: HTMLElement | null = null
  let lockUntil = 0

  /** 指针按下 / 滚轮：用户要自己滚，立刻解除锁定 */
  function unlock() {
    lockedEl = null
  }

  function lock(el: HTMLElement) {
    lockedEl = el
    lockUntil = performance.now() + LOCK_MS
  }

  function follow(src: EventTarget | null, dst: HTMLElement | null) {
    if (!(src instanceof HTMLElement)) return
    if (lockedEl && performance.now() > lockUntil) lockedEl = null
    // 该元素的滚动是我们刚写出来的回声 → 忽略，避免 A→B→A 的无限振铃
    if (!dst || src === lockedEl) return
    const srcMax = src.scrollHeight - src.clientHeight
    const dstMax = dst.scrollHeight - dst.clientHeight
    if (srcMax <= 0 || dstMax <= 0) return
    const target = Math.round((src.scrollTop / srcMax) * dstMax)
    if (Math.abs(dst.scrollTop - target) <= 1) return
    lock(dst)
    dst.scrollTop = target
  }

  /** 编辑区滚动 → 预览跟随 */
  function fromSource(e: Event) {
    follow(e.target, targets.preview())
  }

  /** 预览滚动 → 编辑区跟随 */
  function fromPreview(e: Event) {
    follow(e.target, targets.source())
  }

  /**
   * 内容变化会重建预览 DOM，可能把 scrollTop 冲回 0。
   * 按变化前的比例还原，避免「一边打字一边被拉回顶部」。
   */
  async function keepRatio(el: HTMLElement | null) {
    if (!el) return
    const maxBefore = el.scrollHeight - el.clientHeight
    const ratio = maxBefore > 0 ? el.scrollTop / maxBefore : 0
    await nextTick()
    const maxAfter = el.scrollHeight - el.clientHeight
    const target = Math.round(ratio * maxAfter)
    if (Math.abs(el.scrollTop - target) <= 1) return
    lock(el)
    el.scrollTop = target
  }

  return { unlock, fromSource, fromPreview, keepRatio }
}
