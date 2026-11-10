<template>
  <div class="log-modal-mask" @click.self="$emit('close')">
    <div class="log-modal" role="dialog" aria-label="终端日志">
      <div class="log-modal-header">
        <span class="log-modal-title">终端日志</span>
        <span class="log-modal-count">{{ filteredLogs.length }}/{{ logs.length }}</span>
        <div class="log-modal-actions">
          <button
            type="button"
            class="log-action-btn"
            title="复制当前筛选日志"
            :disabled="!filteredLogs.length"
            @click="copyLogs"
          >
            复制
          </button>
          <button
            type="button"
            class="log-action-btn danger"
            title="清空全部日志"
            :disabled="!logs.length"
            @click="$emit('clear')"
          >
            清空
          </button>
          <button type="button" class="log-modal-close" title="关闭 (Esc)" @click="$emit('close')">✕</button>
        </div>
      </div>

      <div class="log-toolbar">
        <div class="log-filters" role="tablist" aria-label="日志筛选">
          <button
            v-for="f in filters"
            :key="f.id"
            type="button"
            class="log-filter"
            :class="{ active: filter === f.id }"
            role="tab"
            :aria-selected="filter === f.id"
            @click="filter = f.id"
          >
            {{ f.label }}
          </button>
        </div>
        <input
          v-model.trim="query"
          class="log-search"
          type="search"
          placeholder="搜索…"
          aria-label="搜索日志"
        />
      </div>

      <div class="alarm-history">
        <div class="alarm-history-header">
          报警记录 <span class="alarm-history-count">{{ alarmHistory.length }}</span>
        </div>
        <div class="alarm-history-list">
          <div v-for="(item, i) in alarmHistory" :key="i" class="alarm-history-item">
            <span class="alarm-history-time">{{ item.t }}</span>
            <span class="alarm-history-event" :class="eventClass(item.event)">{{ item.event }}</span>
            <span v-if="item.detail" class="alarm-history-detail">{{ item.detail }}</span>
          </div>
          <p v-if="!alarmHistory.length" class="alarm-history-empty">暂无报警记录</p>
        </div>
      </div>

      <div class="log-box" ref="boxRef" tabindex="0">
        <p
          v-for="(log, i) in filteredLogs"
          :key="i"
          :class="logTone(log)"
        >>> {{ log }}</p>
        <p v-if="!filteredLogs.length" class="log-empty">
          {{ logs.length ? '无匹配日志' : '暂无日志' }}
        </p>
      </div>

      <p v-if="copyHint" class="log-copy-hint">{{ copyHint }}</p>
    </div>
  </div>
</template>

<script setup>

/**
 * 终端日志弹窗：筛选（告警/链路/系统）+ 搜索 + 报警历史 + 复制
 * logs/alarmHistory 由 App 注入；清空只清运行日志，不清报警历史（除非上层 reset）。
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  logs: { type: Array, default: () => [] },
  alarmHistory: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'clear']);

const boxRef = ref(null);
const filter = ref('all');
const query = ref('');
const copyHint = ref('');
let copyTimer = null;

const filters = [
  { id: 'all', label: '全部' },
  { id: 'alarm', label: '告警' },
  { id: 'mqtt', label: '链路' },
  { id: 'sys', label: '系统' },
];

const eventClass = (event) => {
  if (event === '触发' || event === '手动开') return 'alarm-on';
  if (event === '恢复' || event === '手动关') return 'alarm-off';
  return 'alarm-mute';
};

const matchFilter = (log, id) => {
  const s = String(log || '');
  if (id === 'alarm') return /告警|报警|阈值|超限|【报警】|buzzer/i.test(s);
  if (id === 'mqtt') return /云端|网络|链路|Broker|MQTT|主题|连接/i.test(s);
  if (id === 'sys') return /系统|场景|屏显|导出|3D|视角|拆解|组装|我家/i.test(s);
  return true;
};

const filteredLogs = computed(() => {
  const q = query.value.toLowerCase();
  return props.logs.filter((log) => {
    if (!matchFilter(log, filter.value)) return false;
    if (!q) return true;
    return String(log).toLowerCase().includes(q);
  });
});

const logTone = (log) => {
  const s = String(log || '');
  if (/失败|出错|超时|离线|超限|告警|报警/.test(s)) return 'tone-bad';
  if (/已连接|恢复|成功|在线|复位|组装/.test(s)) return 'tone-ok';
  return '';
};

const copyLogs = async () => {
  const text = filteredLogs.value.join('\n');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyHint.value = `已复制 ${filteredLogs.value.length} 条`;
  } catch (_) {
    copyHint.value = '复制失败（浏览器权限）';
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copyHint.value = ''; }, 1800);
};

const onKey = (e) => {
  if (e.key === 'Escape') emit('close');
};

watch(
  () => [props.logs.length, filter.value, query.value],
  async () => {
    await nextTick();
    if (boxRef.value) boxRef.value.scrollTop = boxRef.value.scrollHeight;
  }
);

onMounted(() => {
  window.addEventListener('keydown', onKey);
  nextTick(() => boxRef.value?.focus?.());
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  clearTimeout(copyTimer);
});
</script>

<style scoped>
.log-modal-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.log-action-btn {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(148, 163, 184, 0.08);
  color: #cbd5e1;
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.log-action-btn:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.16);
  color: #fff;
}
.log-action-btn.danger:hover:not(:disabled) {
  border-color: rgba(244, 63, 94, 0.45);
  color: #fda4af;
  background: rgba(244, 63, 94, 0.12);
}
.log-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.16);
}
.log-filters {
  display: flex;
  gap: 4px;
  flex: none;
}
.log-filter {
  border: 1px solid transparent;
  background: transparent;
  color: #636366;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.log-filter:hover {
  color: #111113;
  background: rgba(0, 0, 0, 0.08);
}
.log-filter.active {
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border-color: rgba(0, 122, 255, 0.25);
}
.log-search {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.12);
  color: #111113;
  border-radius: 980px;
  padding: 5px 12px;
  font-size: 12px;
  outline: none;
}
.log-search:focus {
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}
.log-box p.tone-bad { color: #fda4af; }
.log-box p.tone-ok { color: #86efac; }
.log-empty {
  color: #636366;
  font-size: 12px;
}
.log-copy-hint {
  margin: 0;
  padding: 6px 14px 10px;
  font-size: 11px;
  color: #86efac;
  text-align: right;
}
.alarm-history {
  border-bottom: 1px solid var(--border);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.alarm-history-header {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}
.alarm-history-count {
  font-size: 11px;
  color: var(--text-mute);
  margin-left: 4px;
}
.alarm-history-list {
  max-height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.alarm-history-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  font-family: var(--mono);
}
.alarm-history-time {
  color: var(--text-mute);
  flex: none;
}
.alarm-history-event {
  flex: none;
  font-weight: 600;
}
.alarm-history-event.alarm-on { color: var(--danger); }
.alarm-history-event.alarm-off { color: var(--success); }
.alarm-history-event.alarm-mute { color: var(--warning); }
.alarm-history-detail {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alarm-history-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-mute);
}
</style>
