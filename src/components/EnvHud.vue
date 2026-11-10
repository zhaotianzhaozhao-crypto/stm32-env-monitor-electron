<template>
  <div class="env-hud" role="status" aria-label="环境监测速览" :title="hudTitle">
    <div
      v-for="row in rows"
      :key="row.key"
      class="env-hud-row"
      :class="row.levelClass"
    >
      <span class="env-hud-label">{{ row.label }}</span>
      <span class="env-hud-value" :class="row.hue">{{ row.display }}</span>
      <span v-if="row.unit" class="env-hud-unit">{{ row.unit }}</span>
      <span v-if="row.badge" class="env-hud-badge">{{ row.badge }}</span>
    </div>
  </div>
</template>

<script setup>
/**
 * 模型区左上角环境 HUD（小监控条）
 * 仅在非「环境监测」Tab 显示；只读，不挡 3D（容器 pointer-events:none）。
 */
import { computed } from 'vue';
import { SENSOR_META } from '../config.js';

const props = defineProps({
  temp: { default: '--' },
  humidity: { default: '--' },
  aqi: { default: '--' },
  tempAlertLevel: { type: String, default: '' },
  humAlertLevel: { type: String, default: '' },
  aqiAlertLevel: { type: String, default: '' },
  dataOnline: { type: Boolean, default: false },
});

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '--';
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  }
  const s = String(v).trim();
  return s || '--';
};

const levelMeta = (level) => {
  if (level === 'alert') return { levelClass: 'is-alert', badge: '超限' };
  if (level === 'warn') return { levelClass: 'is-warn', badge: '偏低' };
  return { levelClass: '', badge: '' };
};

const rows = computed(() => {
  const t = levelMeta(props.tempAlertLevel);
  const h = levelMeta(props.humAlertLevel);
  const a = levelMeta(props.aqiAlertLevel);
  return [
    {
      key: 'temp',
      label: SENSOR_META.temp?.label || '温度',
      display: fmt(props.temp),
      unit: SENSOR_META.temp?.unit || '℃',
      hue: SENSOR_META.temp?.valueClass || 'temp',
      ...t,
    },
    {
      key: 'humidity',
      label: SENSOR_META.humidity?.label || '湿度',
      display: fmt(props.humidity),
      unit: SENSOR_META.humidity?.unit || '%',
      hue: SENSOR_META.humidity?.valueClass || 'hum',
      ...h,
    },
    {
      key: 'aqi',
      label: '气体',
      display: fmt(props.aqi),
      unit: SENSOR_META.aqi?.unit || '',
      hue: SENSOR_META.aqi?.valueClass || 'aqi',
      ...a,
    },
  ];
});

const hudTitle = computed(() =>
  props.dataOnline ? '环境速览 · 硬件在线' : '环境速览 · 等待上报',
);
</script>

<style scoped>
.env-hud {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 22;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 132px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.10);
  backdrop-filter: saturate(160%) blur(18px);
  -webkit-backdrop-filter: saturate(160%) blur(18px);
  pointer-events: none;
  user-select: none;
}
.env-hud-row {
  display: grid;
  grid-template-columns: 34px minmax(36px, 1fr) auto auto;
  align-items: baseline;
  column-gap: 6px;
  padding: 2px 4px;
  border-radius: 8px;
}
.env-hud-row.is-alert {
  background: rgba(255, 59, 48, 0.16);
}
.env-hud-row.is-warn {
  background: rgba(255, 149, 0, 0.16);
}
.env-hud-label {
  font-size: 10px;
  font-weight: 700;
  color: #636366;
  letter-spacing: 0.02em;
}
.env-hud-value {
  font-size: 13px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  color: #1c1c1e;
  text-align: right;
}
.env-hud-value.temp { color: #c46a00; }
.env-hud-value.hum { color: #0066d6; }
.env-hud-value.aqi { color: #7a2fd0; }
.env-hud-row.is-alert .env-hud-value { color: #d70015; }
.env-hud-row.is-warn .env-hud-value { color: #b25000; }
.env-hud-unit {
  font-size: 10px;
  font-weight: 650;
  color: #8e8e93;
  min-width: 1.1em;
}
.env-hud-badge {
  font-size: 9px;
  font-weight: 750;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  color: #3a3a3c;
  justify-self: end;
}
.env-hud-row.is-alert .env-hud-badge {
  background: rgba(215, 0, 21, 0.18);
  color: #d70015;
}
.env-hud-row.is-warn .env-hud-badge {
  background: rgba(178, 80, 0, 0.16);
  color: #b25000;
}
</style>
