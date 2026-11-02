// 文件：packages/markdown-editor/src/composables/useHistory.ts
// 撤销 / 重做历史栈。
// 从主组件里抽出来的原因：这段逻辑有五个闭包变量（两个栈、基线、时间戳、回声队列）
// 和一套合并规则，跟渲染、工具栏毫无关系，混在组件的 500 行里最难读。
//
// 它只管「栈」，不碰 DOM 也不 emit——应用新值由调用方在自己 commit 里做，
// 这样组件仍然是唯一写 textarea 的地方。
import { computed, ref } from 'vue'

/** 连续输入合并成一个历史格的默认判定窗口（毫秒） */
const MERGE_WINDOW = 800
/** 出现这些字符就断句：空格、标点、括号、引号。合并越过它们手感会很怪 */
const BREAK_RE = /[\s，。！？；：、,.!?;:（）()「」『』“”"'']/
/** 历史栈上限：评论框级别的使用量够用，也不至于让长文吃满内存 */
const MAX_STEPS = 200

export interface HistoryOptions {
  /** 初始文本，作为第一次撤销的基线 */
  initial: string
  /**
   * 连续输入合并窗口（毫秒）。默认 800，传 0 表示不合并（每次改动单独一步）。
   * 允许传函数：宿主要在运行时改粒度（比如「专注模式放宽一些」），
   * 不必重建组件，判定时现取即可。
   */
  mergeWindow?: number | (() => number)
}

export function useHistory({ initial, mergeWindow = MERGE_WINDOW }: HistoryOptions) {
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])
  /** 上一次确认过的值，撤销 / 重做与合并判定都以它为基线 */
  let lastVal = initial
  let lastEditAt = 0

  // 自己 emit 出去的值：父组件回灌时按「回声」处理，不当成外部改动。
  // 用队列而不是布尔标志——父组件把值归一化成别的样子、或异步才回灌时，
  // 布尔标志会残留，把下一次真正的外部改动误判成自己写的。
  let pending: string[] = []

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /**
   * 取当前的合并窗口。每次判断都现取：宿主可能运行中改了这个值，
   * 也可能传的是 getter（挂到 props 上）。非法值统一退回默认 800。
   */
  function mergeWindowMs(): number {
    const v = typeof mergeWindow === 'function' ? mergeWindow() : mergeWindow
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : MERGE_WINDOW
  }

  /**
   * 记录一次改动。
   * 合并判据（同时成立才不压栈）：距上次输入 < mergeWindow（默认 800ms，0 表示不合并）、
   * 新值是旧值的纯追加、追加内容不超过 2 个字符且不含空白与标点。
   * 这样「打一个词」是一次撤销，「空格 / 标点 / 停顿」自然断句；
   * 工具栏动作（force）永远单独占一格。
   */
  function record(v: string, opts: { force?: boolean } = {}) {
    if (v === lastVal) return
    const now = Date.now()
    const added = v.slice(lastVal.length)
    const win = mergeWindowMs()
    const merge =
      !opts.force &&
      win > 0 &&
      now - lastEditAt < win &&
      undoStack.value.length > 0 &&
      v.startsWith(lastVal) &&
      added.length > 0 &&
      added.length <= 2 &&
      !BREAK_RE.test(added)
    if (!merge) undoStack.value.push(lastVal)
    if (undoStack.value.length > MAX_STEPS) undoStack.value.shift()
    redoStack.value = []
    lastVal = v
    lastEditAt = opts.force ? 0 : now
  }

  /** emit 之前登记一下，父组件回灌同名值时据此判定为回声 */
  function expectEcho(v: string) {
    pending.push(v)
  }

  /**
   * 处理父组件回灌的值。
   * @returns true 表示这是自己刚 emit 出去的回声，调用方无需再写 DOM / 清历史
   */
  function isEcho(v: string): boolean {
    const i = pending.indexOf(v)
    if (i > -1) { pending.splice(0, i + 1); return true }
    pending.length = 0
    return false
  }

  /** 外部改了内容：重设基线并清空历史，避免脏记录 */
  function reset(v: string) {
    lastVal = v
    undoStack.value = []
    redoStack.value = []
    lastEditAt = 0
  }

  /**
   * 撤销一步，返回要恢复到的文本（null = 没有可撤销的）。
   * 这里顺手把 lastVal 提前改成目标值，调用方随后的 commit 就会因为
   * 「值没变」而不压栈——顺序反了会出现「撤销一次却压进一格」的假历史。
   */
  function undo(): string | null {
    if (!undoStack.value.length) return null
    redoStack.value.push(lastVal)
    const prev = undoStack.value.pop() as string
    lastVal = prev
    return prev
  }

  function redo(): string | null {
    if (!redoStack.value.length) return null
    undoStack.value.push(lastVal)
    const next = redoStack.value.pop() as string
    lastVal = next
    return next
  }

  return { canUndo, canRedo, record, expectEcho, isEcho, reset, undo, redo }
}
