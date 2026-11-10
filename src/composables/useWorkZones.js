/**
 * 工作区间配置（趋势弹窗：卡片名 / 单位 / 数据通道 / 绑定执行设备）
 *
 * 【做什么】每个区间槽（默认 temp/humidity/aqi + 用户「添加采集卡」自定义卡）对应：
 *   name=侧栏卡片显示名；channel=上行传感器字段；deviceId=超限时下发指令的执行器；
 *   单位/颜色/rangeMode；上下限仍由 useAlarm 管。
 * 【三层语义】卡片名 ≠ 数据通道 ≠ 执行设备；改绑设备不得改写 name。
 * 【note】旧字段仍可读入持久化，1.3.10 起 UI 不再展示/编辑用途备注。
 * 【持久化】localStorage `naijiaren.workZones`。
 * 【改时注意】channel 键与 SENSOR_KEYS / 历史采样字段对齐；自定义通道若无上行数据，曲线会空。
 */
import { ref, readonly } from 'vue';
import { SENSOR_META, DEFAULT_THRESHOLDS } from '../config.js';

const STORAGE_KEY = 'naijiaren.workZones';

const DEFAULT_ZONE_META = {
  temp: {
    name: '温度采集',
    note: '数据采集',
    unit: SENSOR_META.temp?.unit || '℃',
    color: SENSOR_META.temp?.color || '#FF9500',
    rangeMode: 'minmax',
    step: 0.5,
  },
  humidity: {
    name: '湿度采集',
    note: '数据采集',
    unit: SENSOR_META.humidity?.unit || '%',
    color: SENSOR_META.humidity?.color || '#007AFF',
    rangeMode: 'minmax',
    step: 1,
  },
  aqi: {
    name: '空气质量采集',
    note: '数据采集',
    unit: SENSOR_META.aqi?.unit || '',
    color: SENSOR_META.aqi?.color || '#AF52DE',
    rangeMode: 'maxonly',
    step: 1,
  },
};

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveRaw(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function normalizeZone(id, stored, fallbackDeviceId) {
  const base = DEFAULT_ZONE_META[id] || {
    name: `${id} 工作区间`,
    note: '数据采集',
    unit: '',
    color: '#007AFF',
    rangeMode: 'minmax',
    step: 1,
  };
  const s = stored || {};
  return {
    id,
    name: String(s.name || base.name).trim().slice(0, 40) || base.name,
    /** 用途/采集备注（如「数据采集」）；可空，不写死温湿度 */
    note: s.note != null ? String(s.note).trim().slice(0, 24) : (base.note || ''),
    unit: s.unit != null ? String(s.unit).slice(0, 8) : base.unit,
    color: String(s.color || base.color),
    rangeMode: s.rangeMode === 'maxonly' ? 'maxonly' : 'minmax',
    step: Number.isFinite(Number(s.step)) ? Number(s.step) : base.step,
    deviceId: s.deviceId ? String(s.deviceId) : fallbackDeviceId,
    /** 绑定的历史/实时通道；默认与 id 相同 */
    channel: String(s.channel || id),
    min: Number.isFinite(Number(s.min)) ? Number(s.min) : undefined,
    max: Number.isFinite(Number(s.max)) ? Number(s.max) : undefined,
  };
}

/**
 * @param {{ devices: import('vue').Ref|import('vue').DeepReadonly, has: (id:string)=>boolean, getDefaultDeviceId: ()=>string }} deviceApi
 */
export function useWorkZones(deviceApi) {
  /** 默认绑定执行器：优先蜂鸣 → 风扇 → 灯光；不再默认绑同名传感 */
  const pickDevice = (_zoneId) => {
    if (typeof deviceApi.findIdByType === 'function') {
      for (const t of ['buzzer', 'fan', 'light']) {
        const id = deviceApi.findIdByType(t);
        if (id) return id;
      }
    }
    return deviceApi.getDefaultDeviceId();
  };
  const raw = loadRaw() || {};
  const builtinIds = ['temp', 'humidity', 'aqi'];
  const initial = {};
  const allIds = [
    ...builtinIds,
    ...Object.keys(raw).filter((id) => !builtinIds.includes(id)),
  ];
  for (const id of allIds) {
    initial[id] = normalizeZone(id, raw[id], pickDevice(id));
    // 旧设备 id 失效时回落到同类型 / 默认台
    if (initial[id].deviceId && !deviceApi.has(initial[id].deviceId)) {
      const keepTx = typeof deviceApi.hasTx === 'function' && deviceApi.hasTx(initial[id].deviceId);
      const looksTx = String(initial[id].deviceId).startsWith('tx_');
      if (!keepTx && !looksTx) initial[id].deviceId = pickDevice(id);
    }
  }

  const zones = ref(initial);

  const uidZone = () =>
    `zone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  /** 新增采集卡（自定义工作区间）；返回新 id */
  const addZone = (patch = {}) => {
    const id = String(patch.id || uidZone());
    if (zones.value[id]) return null;
    const nCustom = Object.keys(zones.value).filter((k) => !builtinIds.includes(k)).length;
    const name =
      String(patch.name || `采集卡 ${nCustom + 1}`).trim().slice(0, 40) || `采集卡 ${nCustom + 1}`;
    const channel = String(patch.channel || 'temp').trim() || 'temp';
    const deviceId = patch.deviceId ? String(patch.deviceId) : pickDevice(id);
    const stored = {
      name,
      note: patch.note != null ? String(patch.note) : '数据采集',
      unit: patch.unit != null ? String(patch.unit) : '',
      color: patch.color || '#007AFF',
      rangeMode: patch.rangeMode === 'maxonly' ? 'maxonly' : 'minmax',
      step: patch.step != null ? Number(patch.step) : 1,
      deviceId,
      channel,
      min: patch.min,
      max: patch.max,
    };
    const z = normalizeZone(id, stored, deviceId);
    // 自定义阈值挂在 zone 上（内置三卡仍走 useAlarm）
    if (Number.isFinite(Number(patch.min))) z.min = Number(patch.min);
    if (Number.isFinite(Number(patch.max))) z.max = Number(patch.max);
    zones.value = { ...zones.value, [id]: z };
    persist();
    return id;
  };

  /** 删除自定义采集卡；内置 temp/humidity/aqi 不可删 */
  const removeZone = (id) => {
    const key = String(id || '');
    if (!key || builtinIds.includes(key)) return false;
    if (!zones.value[key]) return false;
    const next = { ...zones.value };
    delete next[key];
    zones.value = next;
    persist();
    return true;
  };

  const persist = () => {
    const out = {};
    for (const id of Object.keys(zones.value)) {
      const z = zones.value[id];
      out[id] = {
        name: z.name,
        note: z.note || '',
        unit: z.unit,
        color: z.color,
        rangeMode: z.rangeMode,
        step: z.step,
        deviceId: z.deviceId,
        channel: z.channel,
      };
      if (Number.isFinite(Number(z.min))) out[id].min = Number(z.min);
      if (Number.isFinite(Number(z.max))) out[id].max = Number(z.max);
    }
    saveRaw(out);
  };

  const getZone = (id) => zones.value[id] || null;

  const updateZone = (id, patch) => {
    if (!zones.value[id]) return;
    const cur = zones.value[id];
    const next = { ...cur };
    if (patch.name != null) {
      const n = String(patch.name).trim().slice(0, 40);
      if (n) next.name = n;
    }
    if (patch.note != null) next.note = String(patch.note).trim().slice(0, 24);
    if (patch.unit != null) next.unit = String(patch.unit).slice(0, 8);
    if (patch.color != null) next.color = String(patch.color);
    if (patch.rangeMode === 'minmax' || patch.rangeMode === 'maxonly') {
      next.rangeMode = patch.rangeMode;
    }
    if (patch.step != null && Number.isFinite(Number(patch.step))) {
      next.step = Number(patch.step);
    }
    if (patch.deviceId != null) {
      const did = String(patch.deviceId);
      // 允许用户设备 id，或软件配置·下发指令 id（hasTx）
      if (deviceApi.has(did) || (typeof deviceApi.hasTx === 'function' && deviceApi.hasTx(did))) {
        next.deviceId = did;
      } else if (did) {
        // 仍写入，避免下拉选用后被静默丢弃（采集卡按名称选配置）
        next.deviceId = did;
      }
    }
    if (patch.channel != null) next.channel = String(patch.channel);
    if (patch.min != null && Number.isFinite(Number(patch.min))) next.min = Number(patch.min);
    if (patch.max != null && Number.isFinite(Number(patch.max))) next.max = Number(patch.max);
    zones.value = { ...zones.value, [id]: next };
    persist();
  };

  /** 某设备被删后，所有引用改绑到 fallbackId */
  const rebindDevice = (removedId, fallbackId) => {
    let changed = false;
    const next = { ...zones.value };
    for (const id of Object.keys(next)) {
      if (next[id].deviceId === removedId) {
        next[id] = { ...next[id], deviceId: fallbackId };
        changed = true;
      }
    }
    if (changed) {
      zones.value = next;
      persist();
    }
  };

  // 仅供文档/默认阈值对照（未写入本 store）
  void DEFAULT_THRESHOLDS;

  return {
    zones: readonly(zones),
    getZone,
    updateZone,
    addZone,
    removeZone,
    rebindDevice,
    DEFAULT_ZONE_META,
  };
}
