<template>
  <div
    class="sensor-card"
    :class="[
      valueClass ? `hue-${valueClass}` : '',
      {
        clickable,
        alert: alertLevel === 'alert',
        warn: alertLevel === 'warn',
        offline: isOffline,
        wide,
      },
    ]"
    :title="clickable ? '点击查看趋势与工作区间' : undefined"
    @click="onCardClick"
  >
    <div class="sensor-card-top">
      <div class="sensor-label-wrap">
        <span class="sensor-label">{{ label }}</span>
        <span v-if="deviceName" class="sensor-device">{{ deviceName }}</span>
      </div>
      <span v-if="alertLevel === 'alert'" class="sensor-badge">超限</span>
      <span v-else-if="alertLevel === 'warn'" class="sensor-badge warn">偏低</span>
      <span v-else-if="isOffline" class="sensor-badge muted">离线</span>
      <span v-else-if="clickable" class="sensor-hint">趋势</span>
    </div>

    <span class="sensor-value" :class="[valueClass, { active: valueActive }]">
      {{ displayValue }}<span v-if="!isOffline && unit" class="sensor-unit">{{ unit }}</span>
    </span>

    <div v-if="showBar" class="sensor-meta">
      <div class="sensor-bar">
        <div
          class="sensor-bar-fill"
          :class="{ danger: alertLevel === 'alert', warn: alertLevel === 'warn' }"
          :style="{ width: barPercent + '%' }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>

/**
 * 单传感器卡片：数值、进度条、alert/warn/离线条样式；可点击打开趋势。
 * alertLevel：内置卡由 useAlarm 传入；自定义/改绑卡由 EnvMonitor.computeAlert 计算。
 */
import { computed } from 'vue';

const props = defineProps({
  label: String,
  /** 绑定执行设备名（来自 workZones.deviceId → 蜂鸣/风扇/灯光等；与卡片名无关） */
  deviceName: { type: String, default: '' },
  value: [String, Number],
  valueClass: String,
  valueActive: Boolean,
  clickable: Boolean,
  /** 'alert' | 'warn' | '' */
  alertLevel: { type: String, default: '' },
  min: [String, Number],
  max: [String, Number],
  unit: { type: String, default: '' },
  /** 显示进度条（按阈值区间估算） */
  showBar: { type: Boolean, default: true },
  /** 'minmax' = 温度/湿度工作上下限；'maxonly' = AQI 告警阈值 */
  rangeMode: { type: String, default: 'maxonly' },
  wide: Boolean,
});

const emit = defineEmits(['click']);

const isOffline = computed(() => {
  return props.value === '--' || props.value === null || props.value === undefined;
});

const displayValue = computed(() => {
  if (isOffline.value) return '--';
  return props.value;
});

const barPercent = computed(() => {
  if (isOffline.value) return 0;
  const v = Number(props.value);
  if (!Number.isFinite(v)) return 0;

  if (props.rangeMode === 'minmax') {
    const lo = Number(props.min);
    const hi = Number(props.max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return 0;
    const ratio = ((v - lo) / (hi - lo)) * 100;
    return Math.min(100, Math.max(0, ratio));
  }

  const hi = Number(props.max);
  if (!Number.isFinite(hi) || hi <= 0) return 0;
  return Math.min(100, Math.max(0, (v / hi) * 100));
});

const onCardClick = () => {
  if (props.clickable) emit('click');
};
</script>

<style scoped>
.sensor-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.sensor-device {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sensor-hint {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.02em;
  opacity: 0.85;
  flex-shrink: 0;
}
.sensor-card.clickable:hover .sensor-hint {
  color: rgba(255,255,255,0.95);
}
</style>
