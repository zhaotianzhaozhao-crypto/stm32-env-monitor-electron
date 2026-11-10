/**
 * 轻量 Toast 队列（右下角短暂提示）
 * - 同文案+语气正在展示时不重复叠层，只续时
 * - 队列上限，避免刷屏
 * - 默认显示更久，便于看清云端状态
 */
import { ref } from 'vue';

let seq = 0;
const toasts = ref([]);
const timers = new Map();

const DEFAULT_DURATION = 4800; // 显示时长（ms），云端/操作反馈默认约 4.8s
const MAX_TOASTS = 3;

function clearToastTimer(id) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

function scheduleRemove(id, duration) {
  clearToastTimer(id);
  timers.set(
    id,
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
      timers.delete(id);
    }, Math.max(1600, duration)),
  );
}

export function useToast() {
  const push = (message, { tone = 'info', duration = DEFAULT_DURATION } = {}) => {
    const text = String(message || '').trim();
    if (!text) return;

    const existing = toasts.value.find((t) => t.text === text && t.tone === tone);
    if (existing) {
      // 同提示只保留一条，刷新消失时间
      scheduleRemove(existing.id, duration);
      return;
    }

    const id = ++seq;
    const next = [...toasts.value, { id, text, tone }];
    // 超出上限时丢掉最旧的
    while (next.length > MAX_TOASTS) {
      const drop = next.shift();
      if (drop) clearToastTimer(drop.id);
    }
    toasts.value = next;
    scheduleRemove(id, duration);
  };

  const success = (msg, opts) => push(msg, { tone: 'ok', duration: DEFAULT_DURATION, ...opts });
  const error = (msg, opts) => push(msg, { tone: 'bad', duration: DEFAULT_DURATION, ...opts });
  const info = (msg, opts) => push(msg, { tone: 'info', duration: DEFAULT_DURATION, ...opts });

  return { toasts, push, success, error, info, DEFAULT_DURATION };
}
