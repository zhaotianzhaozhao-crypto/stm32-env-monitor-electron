<template>
  <div class="chart-modal" @click.self="$emit('close')">
    <div class="chart-container">
      <div class="chart-header">
        <div class="chart-title-block">
          <h3 class="chart-title">{{ zoneName || '未命名卡片' }}</h3>
          <div class="chart-chips">
            <button
              type="button"
              class="chart-chip sensor"
              :class="{ empty: !sensorLabel, live: sensorLive, wait: !!sensorLabel && !sensorLive }"
              :title="sensorChipTitle"
              @click="onSensorChipClick"
            >
              <i class="tag-lamp" aria-hidden="true" />
              <span class="chip-text">{{ sensorLabel || '未选传感器' }}</span>
              <span class="chip-state">{{ sensorLive ? '有数据' : '等待' }}</span>
            </button>
            <button
              type="button"
              class="chart-chip device"
              :class="{ empty: !deviceLabel, on: deviceOn, off: !!deviceLabel && !deviceOn, muted: !!deviceLabel && !isConnected }"
              :aria-pressed="deviceOn ? 'true' : 'false'"
              :title="deviceChipTitle"
              @click="onDeviceChipClick"
            >
              <span class="chip-switch" aria-hidden="true"><i class="chip-knob" /></span>
              <span class="chip-text">{{ deviceChipName || '未绑定设备' }}</span>
              <span class="chip-state">{{ deviceLabel ? (deviceOn ? '开' : '关') : '' }}</span>
            </button>
          </div>
        </div>

        <div class="chart-header-actions">
          <button
            ref="cfgBtnRef"
            type="button"
            class="close-btn cfg-btn"
            :class="{ active: cfgOpen }"
            title="配置"
            aria-label="配置"
            @click="cfgOpen = !cfgOpen"
          >⚙</button>
          <button type="button" class="close-btn" title="关闭" aria-label="关闭" @click="$emit('close')">×</button>
          <div v-if="cfgOpen" ref="cfgPanelRef" class="modal-config cfg-popover" role="dialog" aria-label="采集卡配置">
            <div class="modal-section modal-section-name">
              <span class="modal-section-tag"><i class="tag-lamp" aria-hidden="true" />显示</span>
              <label class="modal-bound-field name-field">
                <span class="modal-field-label">卡片名称</span>
                <input
                  class="zone-name-input"
                  type="text"
                  maxlength="40"
                  :value="zoneName"
                  placeholder="侧栏显示名"
                  aria-label="卡片名称"
                  @change="$emit('update:zoneName', $event.target.value)"
                  @keydown.enter.prevent="$event.target.blur()"
                />
              </label>
            </div>
            <div class="modal-bind-grid">
              <div class="modal-section">
                <span class="modal-section-tag"><i class="tag-lamp" aria-hidden="true" />数据</span>
                <div class="modal-bound-field grow">
                  <span class="modal-field-label">数据通道（传感器）</span>
                  <YzSelect
                    :model-value="channel"
                    :options="sourceSelectOptions"
                    placeholder="选择数据通道"
                    @update:model-value="onSourceChange"
                  />
                </div>
              </div>
              <div class="modal-section">
                <span class="modal-section-tag"><i class="tag-lamp" aria-hidden="true" />控制</span>
                <div class="modal-bound-field grow">
                  <span class="modal-field-label">绑定执行设备</span>
                  <YzSelect
                    :key="deviceSelectKey"
                    :model-value="boundDeviceSelectId"
                    :options="deviceSelectOptions"
                    placeholder="请选择执行设备"
                    @update:model-value="onDeviceChange"
                  />
                </div>
              </div>
            </div>
            <span class="modal-section-tag"><i class="tag-lamp" aria-hidden="true" />设备工作区间</span>
            <div class="modal-range-fields">
              <template v-if="rangeMode === 'minmax'">
                <label class="modal-bound-field num">
                  <span class="modal-field-label">下限</span>
                  <div class="input-wrapper">
                    <input
                      type="number"
                      :value="min"
                      :step="step"
                      @change="$emit('update:min', Number($event.target.value))"
                    />
                  </div>
                </label>
                <label class="modal-bound-field num">
                  <span class="modal-field-label">上限</span>
                  <div class="input-wrapper">
                    <input
                      type="number"
                      :value="max"
                      :step="step"
                      @change="$emit('update:max', Number($event.target.value))"
                    />
                  </div>
                </label>
              </template>
              <template v-else>
                <label class="modal-bound-field num">
                  <span class="modal-field-label">上限</span>
                  <div class="input-wrapper">
                    <span class="modal-prefix">≤</span>
                    <input
                      type="number"
                      :value="max"
                      :step="step"
                      @change="$emit('update:max', Number($event.target.value))"
                    />
                  </div>
                </label>
              </template>
              <label class="modal-bound-field unit">
                <span class="modal-field-label">显示单位</span>
                <div class="input-wrapper">
                  <input
                    class="unit-input"
                    type="text"
                    maxlength="8"
                    :value="unit"
                    :placeholder="unitPlaceholder"
                    @change="$emit('update:unit', $event.target.value)"
                  />
                </div>
              </label>
            </div>
            <div v-if="adding" class="add-device-panel">
              <div class="add-device-title">添加执行设备</div>
              <div class="add-device-row">
                <YzSelect
                  class="add-device-type"
                  v-model="newDeviceType"
                  :options="actuatorSelectOptions"
                  placeholder="设备类型"
                />
                <input
                  ref="addNameRef"
                  v-model="newDeviceName"
                  class="add-device-input"
                  type="text"
                  maxlength="32"
                  :placeholder="`给这台${actuatorTypeLabel}起个名字`"
                  @keydown.enter.prevent="confirmAdd"
                  @keydown.esc.prevent="cancelAdd"
                />
                <button
                  type="button"
                  class="add-device-ok"
                  :disabled="!canConfirmAdd"
                  @click="confirmAdd"
                >
                  添加并选用
                </button>
                <button type="button" class="add-device-cancel" @click="cancelAdd">取消</button>
              </div>
              <p v-if="!canConfirmAdd" class="add-device-hint">请先填写名称</p>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-main">
        <div class="chart-body-wrap">
          <div class="chart-body" ref="echartRef"></div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
/**
 * 趋势弹窗：三层语义分离
 *
 * 【显示】左上角卡片名称 → 只改 workZones[].name，侧栏 SensorCard 显示用
 * 【数据】数据通道 → temp/humidity/aqi 上行传感器字段，决定曲线与历史
 * 【控制】绑定执行设备 → 蜂鸣/风扇/灯光等；超限时由软件下发指令（与数据源无关）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useChart } from '../composables/useChart.js';
import { typeLabel, typeKind } from '../composables/useDevices.js';
import {
  groupTxActuators,
  findTxActuatorGroup,
  stripTxPolarityName,
} from '../composables/useSoftConfig.js';
import YzSelect from './YzSelect.vue';

const FALLBACK_SOURCE_OPTIONS = [
  { id: 'temp', label: '温度传感器' },
  { id: 'humidity', label: '湿度传感器' },
  { id: 'aqi', label: '空气质量' },
];

const ACTUATOR_TYPE_OPTIONS = [
  { id: 'buzzer', label: '蜂鸣' },
  { id: 'fan', label: '风扇' },
  { id: 'light', label: '灯光' },
];

const UNIT_PLACEHOLDER = {
  temp: '℃',
  humidity: '%',
  aqi: 'AQI',
};

const props = defineProps({
  zoneName: { type: String, default: '' },
  type: String,
  color: String,
  min: [String, Number],
  max: [String, Number],
  deviceId: { type: String, default: '' },
  devices: { type: Array, default: () => [] },
  /** 软件配置·接收指令 → 数据通道下拉 */
  rxOptions: { type: Array, default: () => [] },
  /** 软件配置·下发指令 → 绑定执行设备下拉 */
  txOptions: { type: Array, default: () => [] },
  unit: { type: String, default: '' },
  channel: { type: String, default: '' },
  rangeMode: { type: String, default: 'minmax' },
  step: { type: [String, Number], default: 1 },
  history: {
    type: Object,
    default: () => ({ times: [], data: [] }),
  },
  /** 通道最近值；有值则传感器芯片亮「有数据」 */
  liveValue: { type: [String, Number], default: '--' },
  isConnected: { type: Boolean, default: false },
  /** 绑定执行器当前是否开着（蜂鸣/风扇等） */
  deviceOn: { type: Boolean, default: false },
});

const emit = defineEmits([
  'close',
  'update:min',
  'update:max',
  'update:deviceId',
  'update:zoneName',
  'update:unit',
  'update:channel',
  'add-device',
  'toggle-device',
  'configure',
]);

const actuatorTypeOptions = ACTUATOR_TYPE_OPTIONS;

/** 数据通道：优先软件配置接收表；缺省回落内置三路 */
const sourceOptions = computed(() => {
  const rx = Array.isArray(props.rxOptions) ? props.rxOptions : [];
  if (rx.length) {
    return rx.map((r) => ({
      id: r.id || r.key,
      label: r.name || r.label || r.key || r.id,
      key: r.key,
    }));
  }
  return FALLBACK_SOURCE_OPTIONS;
});

const channel = computed(() => {
  const c = String(props.channel || props.type || 'temp');
  const opts = sourceOptions.value;
  if (opts.some((s) => s.id === c || s.key === c)) return c;
  return opts[0]?.id || 'temp';
});

const unitPlaceholder = computed(() => {
  const c = String(channel.value || '');
  const hit = sourceOptions.value.find((s) => s.id === c || s.key === c);
  const key = hit?.key || c;
  return UNIT_PLACEHOLDER[key] || UNIT_PLACEHOLDER[props.type] || '单位';
});

/**
 * 绑定列表：与设备控制旋钮同源。
 * SoftConfig 下发按 :on/:off 配对去重（「灯光关」并入「灯光」）；
 * 无下发表时回落执行器设备；旧绑定不在表内时临时列入并提示改选。
 */
const deviceOptions = computed(() => {
  const groups = groupTxActuators(props.txOptions || []);
  if (groups.length) {
    const mapped = groups.map((g) => ({
      id: g.id,
      name: g.name,
      builtin: false,
      _legacy: false,
      _format: g.onCmd || g.offCmd,
      memberIds: g.memberIds || [],
    }));
    const hit = findTxActuatorGroup(groups, props.deviceId);
    if (props.deviceId && !hit) {
      const list = Array.isArray(props.devices) ? props.devices : [];
      const cur = list.find((d) => d.id === props.deviceId);
      if (cur) return [{ ...cur, _legacy: true, memberIds: [cur.id] }, ...mapped];
      return [
        { id: props.deviceId, name: props.deviceId, _legacy: true, memberIds: [props.deviceId] },
        ...mapped,
      ];
    }
    return mapped;
  }
  const list = Array.isArray(props.devices) ? props.devices : [];
  const actuators = list
    .filter((d) => typeKind(d.type) === 'actuator')
    .map((d) => ({ ...d, _legacy: false, memberIds: [d.id] }));
  const cur = list.find((d) => d.id === props.deviceId);
  if (cur && typeKind(cur.type) !== 'actuator' && !actuators.some((a) => a.id === cur.id)) {
    return [{ ...cur, _legacy: true, memberIds: [cur.id] }, ...actuators];
  }
  return actuators;
});

/** 下拉当前值：旧绑「灯光关」行 id 映射到组 id「灯光」 */
const boundDeviceSelectId = computed(() => {
  const id = String(props.deviceId || '').trim();
  if (!id) return '';
  const hit =
    deviceOptions.value.find((d) => d.id === id) ||
    deviceOptions.value.find((d) => (d.memberIds || []).includes(id));
  return hit?.id || id;
});

/** 旧绑「灯光关」等极性行 → 写回组 id，与旋钮同源 */
watch(
  boundDeviceSelectId,
  (gid) => {
    const cur = String(props.deviceId || '').trim();
    if (!gid || !cur || gid === cur) return;
    const hit = deviceOptions.value.find((d) => d.id === gid);
    if (hit && (hit.memberIds || []).includes(cur)) {
      emit('update:deviceId', gid);
    }
  },
  { immediate: true },
);

const adding = ref(false);
const newDeviceName = ref('');
const newDeviceType = ref('buzzer');
const addNameRef = ref(null);
const deviceSelectKey = ref(0);

const actuatorTypeLabel = computed(() => typeLabel(newDeviceType.value) || '执行设备');
const canConfirmAdd = computed(() => String(newDeviceName.value || '').trim().length > 0);

const pickFirstActuatorId = () => {
  const hit = (props.devices || []).find((d) => typeKind(d.type) === 'actuator');
  return hit?.id || '';
};

const sourceSelectOptions = computed(() =>
  sourceOptions.value.map((s) => ({ value: s.id, label: s.label })),
);

const deviceSelectOptions = computed(() => {
  const list = deviceOptions.value.map((d) => ({
    value: d.id,
    label: `${d.name}${d.builtin ? '（默认）' : ''}${d._legacy ? ' · 非执行器请改选' : ''}`,
  }));
  const hasTxGroups = groupTxActuators(props.txOptions || []).length > 0;
  if (!hasTxGroups) {
    list.push({ value: '__add__', label: '＋ 添加执行设备…' });
  }
  return list;
});

const actuatorSelectOptions = computed(() =>
  actuatorTypeOptions.map((a) => ({ value: a.id, label: a.label })),
);

const onSourceChange = (val) => {
  const id = String(val || '').trim();
  if (!sourceOptions.value.some((s) => s.id === id || s.key === id)) return;
  adding.value = false;
  newDeviceName.value = '';
  emit('update:channel', id);
  // 换数据通道不改卡片名；绑定优先保持下发设备组，否则回落一台执行器
  const groups = groupTxActuators(props.txOptions || []);
  if (props.deviceId && findTxActuatorGroup(groups, props.deviceId)) return;
  const cur = (props.devices || []).find((d) => d.id === props.deviceId);
  if (!cur || typeKind(cur.type) !== 'actuator') {
    const firstTx = groups[0]?.id;
    if (firstTx) emit('update:deviceId', firstTx);
    else {
      const aid = pickFirstActuatorId();
      if (aid) emit('update:deviceId', aid);
    }
  }
};

const onDeviceChange = async (val) => {
  if (val === '__add__') {
    adding.value = true;
    newDeviceName.value = '';
    newDeviceType.value = 'buzzer';
    deviceSelectKey.value += 1;
    await nextTick();
    addNameRef.value?.focus?.();
    return;
  }
  if (val) {
    adding.value = false;
    newDeviceName.value = '';
    emit('update:deviceId', val);
  }
};

const confirmAdd = () => {
  const name = String(newDeviceName.value || '').trim().slice(0, 32);
  if (!name) return;
  const type = ACTUATOR_TYPE_OPTIONS.some((a) => a.id === newDeviceType.value)
    ? newDeviceType.value
    : 'buzzer';
  emit('add-device', { name, type });
  adding.value = false;
  newDeviceName.value = '';
};

const cancelAdd = () => {
  adding.value = false;
  newDeviceName.value = '';
  deviceSelectKey.value += 1;
};

const sensorLabel = computed(() => {
  const c = String(channel.value || '');
  return sourceOptions.value.find((o) => o.id === c || o.key === c)?.label || '';
});

const deviceLabel = computed(() => {
  if (!props.deviceId) return '';
  return deviceOptions.value.find((d) => d.id === props.deviceId)?.name || '';
});

/** SoftConfig「蜂鸣开/关」→ 芯片只显示「蜂鸣」 */
const deviceChipName = computed(() => {
  const raw = deviceLabel.value;
  if (!raw) return '';
  return stripTxPolarityName(raw) || raw;
});

const sensorLive = computed(() => {
  const v = props.liveValue;
  return !(v === '--' || v === null || v === undefined || v === '');
});

const deviceOn = computed(() => !!props.deviceOn);

const canToggleDevice = computed(() => !!props.deviceId && !!deviceLabel.value);

const sensorChipTitle = computed(() => {
  if (!sensorLabel.value) return '未选数据通道，点齿轮配置';
  return sensorLive.value
    ? `数据通道「${sensorLabel.value}」· 已收到上报`
    : `数据通道「${sensorLabel.value}」· 等待硬件上报（需云端已连接）`;
});

const deviceChipTitle = computed(() => {
  if (!deviceLabel.value) return '未绑定执行设备，点齿轮配置';
  if (!props.isConnected) return `绑定「${deviceChipName.value}」· 云端未连接，无法下发`;
  return `点击切换「${deviceChipName.value}」${deviceOn.value ? '关' : '开'}`;
});

const onSensorChipClick = () => {
  cfgOpen.value = true;
  emit('configure', 'channel');
};

const onDeviceChipClick = () => {
  if (!canToggleDevice.value) {
    cfgOpen.value = true;
    emit('configure', 'device');
    return;
  }
  if (!props.isConnected) {
    emit('toggle-device', { deviceId: props.deviceId, on: !deviceOn.value, blocked: 'offline' });
    return;
  }
  emit('toggle-device', { deviceId: props.deviceId, on: !deviceOn.value });
};

const cfgOpen = ref(false);
const cfgPanelRef = ref(null);
const cfgBtnRef = ref(null);

const onDocPointer = (e) => {
  if (!cfgOpen.value) return;
  const t = e.target;
  if (cfgPanelRef.value?.contains(t) || cfgBtnRef.value?.contains(t)) return;
  if (t?.closest?.('.yz-select-menu')) return;
  cfgOpen.value = false;
};

const onDocKey = (e) => {
  if (e.key !== 'Escape' || !cfgOpen.value) return;
  if (document.querySelector('.yz-select-menu')) return;
  cfgOpen.value = false;
};

const chartUnit = computed(() => String(props.unit || '').trim());

const { echartRef, openChart, updateChart, closeChart, handleResize } = useChart();

onMounted(() => {
  window.addEventListener('resize', handleResize);
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onDocKey);
  openChart({ color: props.color, history: props.history, unit: chartUnit.value });
});

watch(
  () => [props.history, chartUnit.value, props.color],
  () => {
    updateChart(props.history, props.color || '#3b82f6', chartUnit.value);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('pointerdown', onDocPointer, true);
  document.removeEventListener('keydown', onDocKey);
  closeChart();
});
</script>

<style scoped>
.chart-header {
  position: relative;
}
.chart-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--yz-metal-ink, #2a3a3e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chart-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.chart-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
  color: var(--yz-metal-ink, #2a3a3e);
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5);
}
.chart-chip {
  cursor: pointer;
  font: inherit;
  appearance: none;
  -webkit-appearance: none;
}
.chart-chip.empty { color: var(--yz-metal-mute, #6a7d83); }
.chart-chip.empty .tag-lamp { background: #9aa8ac; box-shadow: none; }
.chart-chip .chip-text { max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chart-chip .chip-state {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(42, 58, 62, 0.08);
  color: var(--yz-metal-mute, #6a7d83);
}
.chart-chip.sensor.live .tag-lamp {
  background: #3d9a5f;
  box-shadow: 0 0 5px rgba(61, 154, 95, 0.7);
}
.chart-chip.sensor.live .chip-state {
  background: rgba(61, 154, 95, 0.16);
  color: #1f6b3a;
}
.chart-chip.sensor.wait .tag-lamp {
  background: #9aa8ac;
  box-shadow: none;
}
.chart-chip.sensor.wait .chip-state {
  background: rgba(227, 165, 96, 0.18);
  color: #9a6a2a;
}
.chart-chip.device .chip-switch {
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: #9aa8ac;
  position: relative;
  flex-shrink: 0;
  box-shadow: inset 0 1px 2px rgba(2, 29, 37, 0.25);
  transition: background 0.15s ease;
}
.chart-chip.device .chip-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(2, 29, 37, 0.25);
  transition: transform 0.15s ease;
  display: block;
}
.chart-chip.device.on .chip-switch {
  background: var(--yz-amber, #e3a560);
  box-shadow: inset 0 1px 2px rgba(2, 29, 37, 0.18), 0 0 6px rgba(227, 165, 96, 0.45);
}
.chart-chip.device.on .chip-knob { transform: translateX(12px); }
.chart-chip.device.on .chip-state {
  background: rgba(227, 165, 96, 0.22);
  color: #8a5518;
}
.chart-chip.device.off .chip-state { color: var(--yz-metal-mute, #6a7d83); }
.chart-chip.device.muted {
  opacity: 0.72;
}
.chart-chip:focus-visible {
  outline: 2px solid rgba(91, 143, 163, 0.55);
  outline-offset: 2px;
}
.tag-lamp.amber { background: var(--yz-amber, #e3a560); box-shadow: 0 0 5px var(--yz-amber, #e3a560); }
.chart-header-actions { gap: 8px; }
.cfg-btn { font-size: 16px; }
.cfg-btn.active {
  background: linear-gradient(90deg, #b7c5ca, #eef2f1);
  box-shadow:
    inset 2px 2px 4px rgba(2, 29, 37, 0.18),
    inset -1px -1px 2px rgba(255, 255, 255, 0.6);
  color: var(--yz-accent-strong, #3d6f82);
}
.cfg-popover {
  position: absolute;
  top: 44px;
  right: 0;
  z-index: 30;
  width: min(460px, 100%);
  max-height: 70vh;
  overflow: auto;
  background: linear-gradient(145deg, #eef2f1, #c3ced1);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.6),
    -6px 0 12px rgba(255, 255, 255, 0.3),
    12px 8px 24px rgba(2, 29, 37, 0.22);
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}
.chart-title-block {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  flex: 1;
}
.modal-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(145deg, rgba(234, 239, 237, 0.92), rgba(191, 201, 202, 0.75));
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.45),
    10px 0 18px rgba(2, 29, 37, 0.10);
}
.modal-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.modal-section-name .name-field {
  max-width: none;
  width: 100%;
}
.modal-bind-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
@media (max-width: 720px) {
  .modal-bind-grid { grid-template-columns: 1fr; }
}
.modal-section-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  color: var(--yz-metal-mute, #6a7d83);
  text-transform: uppercase;
}
.tag-lamp {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--yz-glow, #fff);
  box-shadow: 0 0 4px #fff, 0 0 8px rgba(255, 255, 255, 0.7);
  display: inline-block;
}
.zone-name-input {
  width: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  border: 1.5px solid var(--yz-rim, #c6ccca);
  color: var(--yz-metal-ink, #2a3a3e);
  border-radius: 12px;
  padding: 7px 12px;
  font-size: 15px;
  font-weight: 700;
  outline: none;
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5);
}
.zone-name-input:focus {
  border-color: var(--yz-accent, #5b8fa3);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5),
    0 0 0 3px rgba(91, 143, 163, 0.22);
}
.chart-header-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.close-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  color: var(--yz-metal-ink, #2a3a3e);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  box-shadow:
    -4px 0 8px rgba(255, 255, 255, 0.4),
    6px 0 12px rgba(2, 29, 37, 0.18),
    inset 1px 1px 1px rgba(255, 255, 255, 0.5);
}
.close-btn:hover {
  filter: brightness(1.04);
  color: #7a1f1a;
}
.close-btn:active {
  transform: scale(0.96);
}
.chart-main {
  display: flex;
  flex: 1;
  min-height: 0;
}
.chart-body-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 16px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(180deg, rgba(234, 239, 237, 0.65), rgba(191, 201, 202, 0.35));
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.5),
    inset -1px -1px 1px rgba(156, 170, 169, 0.35);
  padding: 6px;
  overflow: hidden;
}
.modal-range-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(90deg, #eaefed, #b7c5ca);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.5),
    inset -1px -1px 1px rgba(156, 170, 169, 0.4);
}
.modal-bound-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.modal-bound-field.num { min-width: 84px; }
.modal-bound-field.unit { min-width: 68px; }
.modal-bound-field.grow {
  min-width: 0;
  flex: 1 1 auto;
  max-width: none;
  width: 100%;
}
.modal-field-label {
  font-size: 11px;
  color: var(--yz-metal-mute, #6a7d83);
  font-weight: 650;
}
.input-wrapper {
  display: flex;
  align-items: center;
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  border: 1.5px solid var(--yz-rim, #c6ccca);
  border-radius: 12px;
  padding: 0 8px;
  min-height: 34px;
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5);
}
.input-wrapper:focus-within {
  border-color: var(--yz-accent, #5b8fa3);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5),
    0 0 0 3px rgba(91, 143, 163, 0.2);
}
.input-wrapper input {
  width: 72px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--yz-metal-ink, #2a3a3e);
  padding: 6px 0;
  font-weight: 600;
}
.input-wrapper .unit-input { width: 56px; }
.modal-prefix {
  font-size: 12px;
  color: var(--yz-metal-mute, #6a7d83);
  margin-right: 4px;
}
.select-wrap { padding: 0 4px 0 8px; }
.modal-select {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--yz-metal-ink, #2a3a3e);
  padding: 6px 4px;
  min-height: 32px;
  font-weight: 600;
}
.add-device-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(90deg, #eaefed, #95a7ae);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.5),
    8px 0 14px rgba(2, 29, 37, 0.1);
}
.add-device-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--yz-metal-ink, #2a3a3e);
}
.add-device-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.add-device-type,
.add-device-input {
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  border: 1.5px solid var(--yz-rim, #c6ccca);
  border-radius: 12px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
  color: var(--yz-metal-ink, #2a3a3e);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.45);
}
.add-device-type { flex: 0 0 auto; min-width: 88px; }
.add-device-input { flex: 1 1 160px; min-width: 140px; }
.add-device-input:focus {
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    0 0 0 3px rgba(91, 143, 163, 0.2);
}
.add-device-ok {
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(90deg, #dde3df, #7fa0ab);
  color: #0f1f22;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
  box-shadow:
    -4px 0 8px rgba(255, 255, 255, 0.35),
    6px 0 12px rgba(2, 29, 37, 0.2);
}
.add-device-ok:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.add-device-cancel {
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(90deg, #f0f4f3, #c5d0d4);
  color: var(--yz-accent-strong, #3d6f82);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.add-device-hint {
  margin: 0;
  font-size: 11px;
  color: var(--yz-amber, #e3a560);
  font-weight: 650;
}
</style>

