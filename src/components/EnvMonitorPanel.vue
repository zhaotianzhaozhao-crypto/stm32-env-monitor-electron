<template>
  <SidebarPanel title="环境监测">
    <div
      class="sensor-status-bar"
      :class="statusClass"
      role="button"
      tabindex="0"
      :title="statusActionTitle"
      @click="onStatusClick"
      @keydown.enter.prevent="onStatusClick"
      @keydown.space.prevent="onStatusClick"
    >
      <span class="status-dot" />
      <span class="status-text">{{ statusText }}</span>
      <button
        type="button"
        class="export-btn"
        :disabled="!canExport || exportBusy"
        :title="exportTitle"
        @click="$emit('export-history')"
      >
        <svg
          class="export-ico"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 19h14" />
        </svg>
        <span>{{ exportBusy ? '导出中…' : '导出' }}</span>
      </button>
    </div>

    <div class="sensor-grid">
      <SensorCard
        v-for="card in builtinCards"
        :key="card.type"
        :class="card.cellClass"
        :label="card.label"
        :device-name="card.deviceName"
        :value="card.value"
        :unit="card.unit"
        :value-class="card.valueClass"
        :min="card.min"
        :max="card.max"
        :alert-level="card.alertLevel"
        :range-mode="card.rangeMode"
        :wide="false"
        :clickable="true"
        :show-bar="true"
        @click="openChart(card)"
      />

      <!-- 自定义采集卡叠层：与采集卡同尺寸；末页/角落「添加」 -->
      <div class="collect-stack" :class="{ 'is-add': showingAddFace }">
        <div class="collect-stack-stage">
          <template v-if="showingAddFace">
            <button
              type="button"
              class="add-collect-card"
              title="新增一张采集卡（绑定软件配置·接收指令）"
              @click="onAddFromStack"
            >
              <span class="add-collect-plus" aria-hidden="true">+</span>
              <span class="add-collect-label">添加采集卡</span>
              <span class="add-collect-hint">选用接收通道</span>
            </button>
          </template>
          <template v-else-if="activeCustomCard">
            <SensorCard
              :key="activeCustomCard.type"
              class="cell-custom stack-card"
              :label="activeCustomCard.label"
              :device-name="activeCustomCard.deviceName"
              :value="activeCustomCard.value"
              :unit="activeCustomCard.unit"
              :value-class="activeCustomCard.valueClass"
              :min="activeCustomCard.min"
              :max="activeCustomCard.max"
              :alert-level="activeCustomCard.alertLevel"
              :range-mode="activeCustomCard.rangeMode"
              :wide="false"
              :clickable="true"
              :show-bar="true"
              @click="openChart(activeCustomCard)"
            />
          </template>
        </div>

        <button
          v-if="customCards.length"
          type="button"
          class="stack-add-corner"
          title="再添加一张采集卡"
          @click="onAddFromStack"
        >+</button>

        <div v-if="stackPageCount > 1" class="collect-stack-nav">
          <button type="button" class="stack-nav-btn" title="上一张" @click="prevStack">‹</button>
          <div class="stack-dots" role="tablist" aria-label="采集卡叠层">
            <button
              v-for="(c, i) in customCards"
              :key="c.type + '_dot'"
              type="button"
              class="stack-dot"
              :class="{ active: stackPage === i }"
              :title="c.label"
              @click="stackPage = i"
            />
            <button
              type="button"
              class="stack-dot add"
              :class="{ active: showingAddFace }"
              title="添加采集卡"
              @click="stackPage = customCards.length"
            />
          </div>
          <button type="button" class="stack-nav-btn" title="下一张" @click="nextStack">›</button>
        </div>
      </div>
    </div>

    <div
      v-if="alarmActive && exceededList.length"
      class="alarm-banner"
      role="alert"
    >
      <span class="alarm-icon">!</span>
      <span class="alarm-text">
        阈值触发：{{ exceededList.map((e) => e.label).join('、') }}
      </span>
    </div>
  </SidebarPanel>
</template>

<script setup>
/**
 * 环境监测面板（拆分后的稳定四卡网格）
 * 温度 / 湿度 / 空气质量 + 自定义采集卡叠层；无中心模型环绕、无草图布局
 */
import { computed, ref, watch } from 'vue';
import SidebarPanel from './SidebarPanel.vue';
import SensorCard from './SensorCard.vue';
import { SENSOR_META } from '../config.js';
import { groupTxActuators, findTxActuatorGroup } from '../composables/useSoftConfig.js';

const BUILTIN_IDS = ['temp', 'humidity', 'aqi'];

const props = defineProps({
  temp: { default: '--' },
  humidity: { default: '--' },
  aqi: { default: '--' },
  alarmActive: Boolean,
  tempMin: Number,
  tempMax: Number,
  humMin: Number,
  humMax: Number,
  aqiMax: Number,
  tempAlertLevel: { type: String, default: '' },
  humAlertLevel: { type: String, default: '' },
  aqiAlertLevel: { type: String, default: '' },
  hasHardwareData: Boolean,
  dataOnline: { type: Boolean, default: false },
  isConnected: Boolean,
  workZones: { type: Object, default: () => ({}) },
  devices: { type: Array, default: () => [] },
  txOptions: { type: Array, default: () => [] },
  rxOptions: { type: Array, default: () => [] },
  channelValues: { type: Object, default: () => ({}) },
  canExport: { type: Boolean, default: false },
  historyCount: { type: Number, default: 0 },
  exportBusy: { type: Boolean, default: false },
  screenSkin: { type: String, default: 'industrial-dark' },
});

const emit = defineEmits([
  'openChart',
  'updateThreshold',
  'go-connect',
  'export-history',
  'add-card',
]);

const exportTitle = computed(() => {
  if (props.exportBusy) return '正在生成 Excel…';
  if (!props.canExport || props.historyCount <= 0) {
    return '暂无历史数据，连接设备采集后再导出';
  }
  return `导出 ${props.historyCount} 条传感器历史到 Excel（含图表）`;
});

const zoneOf = (id) => props.workZones?.[id] || {};

const deviceNameOf = (deviceId) => {
  if (!deviceId) return '';
  const groups = groupTxActuators(props.txOptions || []);
  const g = findTxActuatorGroup(groups, deviceId);
  if (g) return g.name || '';
  const tx = (props.txOptions || []).find((x) => x.id === deviceId);
  if (tx) return tx.name || tx.label || '';
  const d = (props.devices || []).find((x) => x.id === deviceId);
  return d?.name || '';
};

const resolveRxKey = (channel) => {
  const c = String(channel || '').trim();
  if (!c) return '';
  const byId = (props.rxOptions || []).find((r) => r.id === c);
  if (byId) return byId.key || byId.id;
  return c;
};

const channelLiveValue = (channel) => {
  const key = resolveRxKey(channel);
  if (!key) return '--';
  const cv = props.channelValues || {};
  if (cv[key] !== undefined && cv[key] !== null && cv[key] !== '') return cv[key];
  if (key === 'temp' || key === 'temperature' || key === 't') return props.temp;
  if (key === 'humidity' || key === 'hum' || key === 'rh') return props.humidity;
  if (key === 'aqi' || key === 'air' || key === 'mq2') return props.aqi;
  return '--';
};

const hueFor = (id, channel) => {
  if (id === 'temp') return SENSOR_META.temp?.valueClass || 'temp';
  if (id === 'humidity') return SENSOR_META.humidity?.valueClass || 'hum';
  if (id === 'aqi') return SENSOR_META.aqi?.valueClass || 'aqi';
  const k = resolveRxKey(channel);
  if (k === 'temp' || k === 'temperature' || k === 't') return 'temp';
  if (k === 'humidity' || k === 'hum' || k === 'rh') return 'hum';
  if (k === 'aqi' || k === 'air' || k === 'mq2') return 'aqi';
  return 'hum';
};

const builtinValue = (id) => {
  if (id === 'temp') return props.temp;
  if (id === 'humidity') return props.humidity;
  if (id === 'aqi') return props.aqi;
  return '--';
};

const builtinAlert = (id) => {
  if (id === 'temp') return props.tempAlertLevel;
  if (id === 'humidity') return props.humAlertLevel;
  if (id === 'aqi') return props.aqiAlertLevel;
  return '';
};

const builtinMin = (id, z) => {
  if (id === 'temp') return props.tempMin;
  if (id === 'humidity') return props.humMin;
  if (Number.isFinite(Number(z?.min))) return Number(z.min);
  return undefined;
};

const builtinMax = (id, z) => {
  if (id === 'temp') return props.tempMax;
  if (id === 'humidity') return props.humMax;
  if (id === 'aqi') return props.aqiMax;
  if (Number.isFinite(Number(z?.max))) return Number(z.max);
  return undefined;
};

/** 自定义卡 / 改绑通道后的越界告警：偏低=warn，超限=alert */
const computeAlert = (id, value, min, max, rangeMode) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const mode = rangeMode || (id === 'aqi' ? 'maxonly' : 'minmax');
  const hi = Number(max);
  const lo = Number(min);
  if (mode === 'maxonly') {
    if (Number.isFinite(hi) && n > hi) return 'alert';
    return '';
  }
  if (Number.isFinite(lo) && n < lo) return 'warn';
  if (Number.isFinite(hi) && n > hi) return 'alert';
  return '';
};

const buildCard = (id) => {
  const z = zoneOf(id);
  const channel = z.channel || id;
  const isBuiltin = BUILTIN_IDS.includes(id);
  // 内置卡若在弹窗中改绑了其他通道，改用通道实时值
  const rebound = isBuiltin && z.channel && String(z.channel) !== String(id);
  const value = isBuiltin && !rebound ? builtinValue(id) : channelLiveValue(channel);
  const meta = SENSOR_META[id] || {};
  const rangeMode = z.rangeMode || (id === 'aqi' ? 'maxonly' : 'minmax');
  const min = builtinMin(id, z);
  const max = builtinMax(id, z);
  const alertLevel = (isBuiltin && !rebound)
    ? builtinAlert(id)
    : computeAlert(id, value, min, max, rangeMode);
  return {
    type: id,
    label: z.name || meta.label || id,
    deviceName: deviceNameOf(z.deviceId),
    value,
    unit: z.unit ?? meta.unit ?? '',
    valueClass: hueFor(id, channel),
    min,
    max,
    rangeMode,
    alertLevel,
    cellClass:
      id === 'temp'
        ? 'cell-temp'
        : id === 'humidity'
          ? 'cell-hum'
          : id === 'aqi'
            ? 'cell-aqi'
            : 'cell-custom',
  };
};

const builtinCards = computed(() => {
  const zones = props.workZones || {};
  const ids = BUILTIN_IDS.filter((id) => zones[id] || !Object.keys(zones).length);
  const list = ids.length ? ids : BUILTIN_IDS;
  return list.map(buildCard);
});

const customCards = computed(() => {
  const zones = props.workZones || {};
  return Object.keys(zones)
    .filter((id) => !BUILTIN_IDS.includes(id))
    .map(buildCard);
});

const stackPage = ref(0);
const stackPageCount = computed(() => Math.max(1, customCards.value.length + 1));
const showingAddFace = computed(
  () => !customCards.value.length || stackPage.value >= customCards.value.length,
);
const activeCustomCard = computed(() => {
  if (showingAddFace.value) return null;
  return customCards.value[stackPage.value] || null;
});

watch(
  () => customCards.value.length,
  (len, prev) => {
    if (len > (prev || 0)) {
      stackPage.value = Math.max(0, len - 1);
    } else if (stackPage.value > len) {
      stackPage.value = len;
    }
  },
);

const prevStack = () => {
  const n = stackPageCount.value;
  if (n <= 1) return;
  stackPage.value = (stackPage.value - 1 + n) % n;
};
const nextStack = () => {
  const n = stackPageCount.value;
  if (n <= 1) return;
  stackPage.value = (stackPage.value + 1) % n;
};
const onAddFromStack = () => emit('add-card');

const allCards = computed(() => [...builtinCards.value, ...customCards.value]);
const exceededList = computed(() =>
  allCards.value
    .filter((c) => c.alertLevel === 'alert' || c.alertLevel === 'warn')
    .map((c) => ({
      type: c.type,
      label: c.alertLevel === 'warn' ? `${c.label}偏低` : `${c.label}超限`,
    })),
);

const statusClass = computed(() => {
  if (props.dataOnline) return 'online';
  if (props.hasHardwareData) return 'stale';
  return 'offline';
});
const statusText = computed(() => {
  if (props.dataOnline) return '硬件数据在线';
  if (props.hasHardwareData) return '数据超时（可能离线）';
  return '等待硬件上报...';
});

const openChart = (card) => emit('openChart', card.type);
</script>

<style scoped>
.collect-stack {
  position: relative;
  width: 100%;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
}
.collect-stack-stage {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
}
.collect-stack-stage :deep(.sensor-card),
.collect-stack-stage .add-collect-card {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: none;
}
.collect-stack:not(.is-add) .collect-stack-stage :deep(.sensor-card) {
  /* 给绝对定位的 ‹›/圆点留底内边距，不撑高卡片 */
  padding-bottom: 28px;
}
.collect-stack-nav {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  pointer-events: none;
  z-index: 2;
}
.collect-stack-nav > * { pointer-events: auto; }
.stack-add-corner {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  color: #2a3a3e;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -3px 0 5px rgba(255,255,255,0.4), 4px 0 8px rgba(2,29,37,0.14);
}
.stack-add-corner:hover { filter: brightness(1.05); }

.add-collect-card {
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: none;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 10px;
  border-radius: 18px;
  border: 1.5px dashed #95a7ae;
  background: linear-gradient(145deg, rgba(234,239,237,0.95), rgba(149,167,174,0.55));
  color: #2a3a3e;
  cursor: pointer;
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.5), 8px 0 14px rgba(2,29,37,0.12);
}
.add-collect-card:hover { filter: brightness(1.04); }
.add-collect-card:active { transform: scale(0.98); }
.add-collect-plus { font-size: 28px; font-weight: 700; line-height: 1; color: #e3a560; }
.add-collect-label { font-size: 12px; font-weight: 700; color: #2a3a3e; }
.add-collect-hint { font-size: 10px; font-weight: 600; color: #6a7d83; }

.stack-nav-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  color: #2a3a3e;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex: none;
}
.stack-nav-btn:hover { filter: brightness(1.05); }
.stack-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.stack-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: none;
  padding: 0;
  background: #6a7d83;
  cursor: pointer;
}
.stack-dot.active {
  background: #fff;
  transform: scale(1.15);
  box-shadow: 0 0 6px #fff;
}
.stack-dot.add {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: rgba(227, 165, 96, 0.45);
}
.stack-dot.add.active {
  background: #e3a560;
  box-shadow: 0 0 6px rgba(227, 165, 96, 0.7);
}

.alarm-banner {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fecaca;
  font-size: 12px;
}
.alarm-icon { flex: none; }
</style>
