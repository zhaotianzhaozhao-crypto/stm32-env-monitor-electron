import { ref, watch } from 'vue';
import { DEFAULT_THRESHOLDS } from '../config.js';

const STORAGE_KEY = 'naijiaren.thresholds';

/** 旧版固定执行器目标 → 迁移时忽略，改绑用户设备 */
const LEGACY_TARGETS = new Set(['buzzer', 'relay', 'both']);

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

/**
 * 解析区间绑定的设备 id：优先用已存 deviceId；旧版 target=buzzer|relay|both 视为无效并回落默认设备。
 */
function resolveDeviceId(raw, fallbackId) {
  const s = raw == null ? '' : String(raw);
  if (!s || LEGACY_TARGETS.has(s.toLowerCase())) return fallbackId;
  return s;
}

function mergeDefaults(stored, fallbackDeviceId) {
  const d = DEFAULT_THRESHOLDS || {};
  const s = stored || {};
  const temp = {
    min: Number.isFinite(Number(s.temp?.min)) ? Number(s.temp.min)
      : Number.isFinite(Number(d.tempMin)) ? Number(d.tempMin)
      : Number.isFinite(Number(d.temp?.min)) ? Number(d.temp.min) : 18,
    max: Number.isFinite(Number(s.temp?.max)) ? Number(s.temp.max)
      : Number.isFinite(Number(d.tempMax ?? d.temp)) ? Number(d.tempMax ?? d.temp)
      : Number.isFinite(Number(d.temp?.max)) ? Number(d.temp.max) : 28,
    deviceId: resolveDeviceId(s.temp?.deviceId ?? s.temp?.target, fallbackDeviceId),
  };
  const humidity = {
    min: Number.isFinite(Number(s.humidity?.min)) ? Number(s.humidity.min)
      : Number.isFinite(Number(d.humidityMin ?? d.humMin)) ? Number(d.humidityMin ?? d.humMin)
      : Number.isFinite(Number(d.humidity?.min)) ? Number(d.humidity.min) : 40,
    max: Number.isFinite(Number(s.humidity?.max)) ? Number(s.humidity.max)
      : Number.isFinite(Number(d.humidityMax ?? d.humMax)) ? Number(d.humidityMax ?? d.humMax)
      : Number.isFinite(Number(d.humidity?.max)) ? Number(d.humidity.max) : 70,
    deviceId: resolveDeviceId(s.humidity?.deviceId ?? s.humidity?.target, fallbackDeviceId),
  };
  const aqiMax = Number.isFinite(Number(s.aqi?.max ?? s.aqiMax ?? s.aqi))
    ? Number(s.aqi?.max ?? s.aqiMax ?? s.aqi)
    : Number.isFinite(Number(d.aqiMax ?? d.aqi)) ? Number(d.aqiMax ?? d.aqi)
    : Number.isFinite(Number(d.aqi?.max)) ? Number(d.aqi.max) : 100;
  const aqiDeviceId = resolveDeviceId(s.aqi?.deviceId ?? s.aqi?.target, fallbackDeviceId);
  return { temp, humidity, aqiMax, aqiDeviceId };
}

/**
 * 报警阈值与状态机
 *
 * 【规则】温湿度：低于 min→warn，≥max→alert；AQI：仅 ≥max→alert（maxonly）。
 * 【输出】优先发绑定执行设备 commands 里的 :on/:off；若无则回落 buzzer:on/off；设备名写入日志。
 * 【状态】forceMode='on'|'off'|null — 手动开期间跳过自动阈值；forceOff/silence 清回自动。
 * 【持久化】localStorage naijiaren.thresholds；deviceId 替代旧 target(蜂鸣/继电器/两者)。
 * 【改时注意】上升沿才发 buzzer:on；未连接时不置 alarmActive，以便重连后补发。
 *
 * @param {{ getDeviceName?: (id:string)=>string, getDefaultDeviceId?: ()=>string }} [deviceApi]
 */
export function useAlarm({ temp, humidity, aqi, isConnected, sendCommand, addLog, getDeviceName, getDefaultDeviceId, getDeviceCommands }) {
  const fallbackDev = () => (typeof getDefaultDeviceId === 'function' ? getDefaultDeviceId() : 'default');
  const initial = mergeDefaults(loadStored(), fallbackDev());

  const tempMin = ref(initial.temp.min);
  const tempMax = ref(initial.temp.max);
  const tempDeviceId = ref(initial.temp.deviceId);
  const humMin = ref(initial.humidity.min);
  const humMax = ref(initial.humidity.max);
  const humDeviceId = ref(initial.humidity.deviceId);
  const aqiMax = ref(initial.aqiMax);
  const aqiDeviceId = ref(initial.aqiDeviceId);

  // 兼容旧解构名：tempTarget 等仍指向 deviceId
  const tempTarget = tempDeviceId;
  const humTarget = humDeviceId;
  const aqiTarget = aqiDeviceId;

  const alarmActive = ref(false);
  /** 记录当前触发报警的执行器设备 ID，确保恢复/静音/关闭时向同一设备发送 :off */
  const activeAlarmDeviceId = ref('');
  /** 手动强制：'on' | 'off' | null（null=跟随阈值自动） */
  const forceMode = ref(null);
  const alarmHistory = ref([]);

  const deviceLabel = (id) => {
    if (typeof getDeviceName === 'function') return getDeviceName(id) || '未命名设备';
    return id || '未命名设备';
  };

  const persist = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          temp: { min: tempMin.value, max: tempMax.value, deviceId: tempDeviceId.value },
          humidity: { min: humMin.value, max: humMax.value, deviceId: humDeviceId.value },
          aqi: { max: aqiMax.value, deviceId: aqiDeviceId.value },
        })
      );
    } catch (_) {}
  };

  watch(
    [tempMin, tempMax, tempDeviceId, humMin, humMax, humDeviceId, aqiMax, aqiDeviceId],
    persist,
    { deep: false }
  );

  const pushHistory = (event, detail = '') => {
    alarmHistory.value.unshift({
      t: new Date().toLocaleTimeString(),
      event,
      detail,
    });
    if (alarmHistory.value.length > 50) alarmHistory.value.length = 50;
  };

  /** 从绑定执行设备的白名单指令中挑开/关；没有则回落蜂鸣协议 */
  const resolveActuatorCmd = (deviceId, on) => {
    const cmds = typeof getDeviceCommands === 'function' ? (getDeviceCommands(deviceId) || []) : [];
    const list = Array.isArray(cmds) ? cmds.map((c) => String(c || '').trim()).filter(Boolean) : [];
    if (on) {
      const hit = list.find((c) => c.endsWith(':on')) || list.find((c) => !c.endsWith(':off'));
      return hit || 'buzzer:on';
    }
    const hit = list.find((c) => c.endsWith(':off'));
    return hit || 'buzzer:off';
  };

  // 发送报警输出指令：按绑定执行设备 commands 下发；设备名记入日志
  const emitOutput = (on, reason, deviceId) => {
    if (!isConnected.value) {
      addLog?.('【报警输出】未连接云端，指令未发送');
      return false;
    }
    const cmd = resolveActuatorCmd(deviceId, on);
    sendCommand?.(cmd);
    const dest = deviceLabel(deviceId);
    addLog?.(
      on
        ? `【报警输出】开启→${dest}（${reason}）→ ${cmd}`
        : `【报警输出】关闭→${dest}（${reason}）→ ${cmd}`
    );
    return true;
  };

  /** 单字段越界级别：'alert' 超上限 / 'warn' 低于下限 / '' 正常或无数据 */
  const levelFor = (raw, min, max, { maxOnly = false } = {}) => {
    if (raw === '--' || raw === null || raw === undefined) return '';
    const v = Number(raw);
    if (!Number.isFinite(v)) return '';
    if (maxOnly) {
      return Number.isFinite(max) && v >= max ? 'alert' : '';
    }
    if (Number.isFinite(max) && v >= max) return 'alert';
    if (Number.isFinite(min) && v < min) return 'warn';
    return '';
  };

  const tempLevel = () => levelFor(temp.value, tempMin.value, tempMax.value);
  const humLevel = () => levelFor(humidity.value, humMin.value, humMax.value);
  const aqiLevel = () => levelFor(aqi.value, null, aqiMax.value, { maxOnly: true });

  /** 多个触发区间的设备：取第一个；全空则默认台 */
  const pickDevice = (ids) => {
    for (const id of ids) {
      if (id) return id;
    }
    return fallbackDev();
  };

  /** 每包传感器数据后由 App 调用：上升沿开蜂鸣、下降沿关；手动模式跳过 */
  const checkThresholds = () => {
    if (forceMode.value === 'on' || forceMode.value === 'off') return;

    const reasons = [];
    const deviceIds = [];
    const t = tempLevel();
    const h = humLevel();
    const a = aqiLevel();
    if (t === 'alert') { reasons.push('温度偏高'); deviceIds.push(tempDeviceId.value); }
    else if (t === 'warn') { reasons.push('温度偏低'); deviceIds.push(tempDeviceId.value); }
    if (h === 'alert') { reasons.push('湿度偏高'); deviceIds.push(humDeviceId.value); }
    else if (h === 'warn') { reasons.push('湿度偏低'); deviceIds.push(humDeviceId.value); }
    if (a === 'alert') { reasons.push('AQI'); deviceIds.push(aqiDeviceId.value); }

    const shouldAlarm = reasons.length > 0;
    const dest = pickDevice(deviceIds);

    if (shouldAlarm && !alarmActive.value) {
      const sent = emitOutput(true, reasons.join(','), dest);
      if (sent) {
        alarmActive.value = true;
        activeAlarmDeviceId.value = dest;
        pushHistory('触发', `${reasons.join(',')} → ${deviceLabel(dest)}`);
      }
    } else if (!shouldAlarm && alarmActive.value) {
      const offDest = activeAlarmDeviceId.value || dest;
      alarmActive.value = false;
      activeAlarmDeviceId.value = '';
      pushHistory('恢复', '环境正常');
      emitOutput(false, '环境数据恢复正常', offDest);
    }
  };

  const setTempMin = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return;
    tempMin.value = v;
    if (tempMax.value < v) tempMax.value = v;
    checkThresholds();
  };
  const setTempMax = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return;
    tempMax.value = v;
    if (tempMin.value > v) tempMin.value = v;
    checkThresholds();
  };
  const setHumMin = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return;
    humMin.value = v;
    if (humMax.value < v) humMax.value = v;
    checkThresholds();
  };
  const setHumMax = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return;
    humMax.value = v;
    if (humMin.value > v) humMin.value = v;
    checkThresholds();
  };
  const setAqiMax = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return;
    aqiMax.value = v;
    checkThresholds();
  };

  const setTempTarget = (id) => {
    tempDeviceId.value = id || fallbackDev();
    checkThresholds();
  };
  const setHumTarget = (id) => {
    humDeviceId.value = id || fallbackDev();
    checkThresholds();
  };
  const setAqiTarget = (id) => {
    aqiDeviceId.value = id || fallbackDev();
    checkThresholds();
  };

  /** 设备被删时，阈值里仍引用旧 id 的改绑到 fallback */
  const rebindAlarmDevice = (removedId, fallbackId) => {
    if (tempDeviceId.value === removedId) tempDeviceId.value = fallbackId;
    if (humDeviceId.value === removedId) humDeviceId.value = fallbackId;
    if (aqiDeviceId.value === removedId) aqiDeviceId.value = fallbackId;
  };

  const forceOn = (targetId) => {
    const dest = targetId || activeAlarmDeviceId.value || fallbackDev();
    forceMode.value = 'on';
    alarmActive.value = true;
    activeAlarmDeviceId.value = dest;
    pushHistory('手动开', '');
    emitOutput(true, '手动', dest);
  };

  const forceOff = (targetId) => {
    const dest = targetId || activeAlarmDeviceId.value || fallbackDev();
    forceMode.value = null;
    alarmActive.value = false;
    activeAlarmDeviceId.value = '';
    pushHistory('手动关', '');
    emitOutput(false, '手动', dest);
  };

  const silence = (reason = '静音') => {
    if (alarmActive.value || forceMode.value === 'on') {
      const dest = activeAlarmDeviceId.value || fallbackDev();
      alarmActive.value = false;
      activeAlarmDeviceId.value = '';
      forceMode.value = null;
      pushHistory('强制关', reason);
      emitOutput(false, reason, dest);
    }
  };

  const reset = () => {
    if (alarmActive.value || forceMode.value === 'on') {
      const dest = activeAlarmDeviceId.value || fallbackDev();
      const offCmd = resolveActuatorCmd(dest, false);
      sendCommand?.(offCmd);
      addLog?.(`【解除】链路断开，已尝试关闭报警输出（${offCmd}）`);
      pushHistory('断开关', '');
    }
    alarmActive.value = false;
    activeAlarmDeviceId.value = '';
    forceMode.value = null;
  };

  return {
    tempMin,
    tempMax,
    tempTarget,
    tempDeviceId,
    humMin,
    humMax,
    humTarget,
    humDeviceId,
    aqiMax,
    aqiTarget,
    aqiDeviceId,
    alarmActive,
    forceMode,
    alarmHistory,
    tempLevel,
    humLevel,
    aqiLevel,
    checkThresholds,
    setTempMin,
    setTempMax,
    setHumMin,
    setHumMax,
    setAqiMax,
    setTempTarget,
    setHumTarget,
    setAqiTarget,
    rebindAlarmDevice,
    forceOn,
    forceOff,
    silence,
    reset,
  };
}
