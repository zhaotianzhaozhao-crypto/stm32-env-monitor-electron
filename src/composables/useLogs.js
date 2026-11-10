/**
 * 运行日志环形缓冲（默认 200 条，新日志 unshift 到顶部）
 * LogPanel 负责筛选/复制；此处只存字符串。
 */
import { ref } from 'vue';

export function useLogs(max = 200) {
  const logs = ref([]);

  const addLog = (msg) => {
    logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (logs.value.length > max) logs.value.length = max;
  };

  const clearLogs = () => {
    logs.value = [];
  };

  return { logs, addLog, clearLogs };
}
