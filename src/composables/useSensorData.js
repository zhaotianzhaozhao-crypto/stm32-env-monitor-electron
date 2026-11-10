/**
 * 传感器上行解析 — 硬件 JSON 唯一识别口
 *
 * 【必选键】temp / humidity / aqi / btn（btn 仅 CW|CCW，无 SW）
 * 【可选】battery/wifi/skin/breath/fan/buzzer
 *         weather / weatherCond / wlow / whigh
 *         hour/minute 或 time:"HH:MM"；month/day 或 date:"M/D"
 * 【副作用】更新 lastRxAt/packetCount；pushSample 写历史；旋钮驱动 rotateKnob
 * 【改协议】与 F411 report / ESP MQTT 桥 / config.SENSOR_KEYS 同步。
 */
import { ref } from 'vue';

function asOn(v) {
  if (v === true || v === 1 || v === '1' || v === 'on' || v === 'ON') return true;
  if (v === false || v === 0 || v === '0' || v === 'off' || v === 'OFF') return false;
  return null;
}

function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseClock(data) {
  const extras = {};
  if (data.hour !== undefined || data.minute !== undefined) {
    const h = asInt(data.hour);
    const m = asInt(data.minute);
    if (h !== null) extras.hour = Math.max(0, Math.min(23, h));
    if (m !== null) extras.minute = Math.max(0, Math.min(59, m));
  } else if (typeof data.time === 'string' && data.time.includes(':')) {
    const [hs, ms] = data.time.split(':');
    const h = asInt(hs);
    const m = asInt(ms);
    if (h !== null) extras.hour = Math.max(0, Math.min(23, h));
    if (m !== null) extras.minute = Math.max(0, Math.min(59, m));
  }
  if (data.month !== undefined || data.day !== undefined) {
    const mo = asInt(data.month);
    const d = asInt(data.day);
    if (mo !== null) extras.month = Math.max(1, Math.min(12, mo));
    if (d !== null) extras.day = Math.max(1, Math.min(31, d));
  } else if (typeof data.date === 'string' && data.date.includes('/')) {
    const [ms, ds] = data.date.split('/');
    const mo = asInt(ms);
    const d = asInt(ds);
    if (mo !== null) extras.month = Math.max(1, Math.min(12, mo));
    if (d !== null) extras.day = Math.max(1, Math.min(31, d));
  }
  return extras;
}

function parseWeather(data) {
  const extras = {};
  const cond = data.weatherCond ?? data.weather_cond ?? data.wcond;
  if (cond !== undefined) {
    const c = asInt(cond);
    if (c !== null) extras.weatherCond = Math.max(0, Math.min(3, c));
  } else if (typeof data.weather === 'string') {
    const map = { sunny: 0, cloudy: 1, overcast: 2, rainy: 3, rain: 3 };
    const key = data.weather.trim().toLowerCase();
    if (key in map) extras.weatherCond = map[key];
  } else if (typeof data.weather === 'number') {
    extras.weatherCond = Math.max(0, Math.min(3, Math.round(data.weather)));
  }
  const low = data.weatherLow ?? data.wlow ?? data.tempLow;
  const high = data.weatherHigh ?? data.whigh ?? data.tempHigh;
  if (low !== undefined) {
    const n = asInt(low);
    if (n !== null) extras.weatherLow = n;
  }
  if (high !== undefined) {
    const n = asInt(high);
    if (n !== null) extras.weatherHigh = n;
  }
  return extras;
}

export function useSensorData(engineRef, addLog, pushSample, getRxEntries) {
  const temp = ref('--');
  const humidity = ref('--');
  const aqi = ref('--');
  const btnState = ref('未触发');
  /** 按解析键缓存的最近值（含自定义键） */
  const channelValues = ref({});

  const lastRxAt = ref(0);
  const packetCount = ref(0);
  /** 最近一次上行里的执行器真值；供 syncScreenExtras 优先采用（at=0 表示尚未收到） */
  const hwActuators = ref({
    buzzerOn: null,
    fanOn: null,
    breathOn: null,
    skin: null,
    at: 0,
  });
  let btnResetTimer = null;

  const resolveRxList = () => {
    try {
      const list = typeof getRxEntries === 'function' ? getRxEntries() : null;
      if (Array.isArray(list) && list.length) return list;
    } catch (_) {}
    return [
      { key: 'temp', name: '温度' },
      { key: 'humidity', name: '湿度' },
      { key: 'aqi', name: '空气质量' },
    ];
  };

  const pickByKeys = (data, keys) => {
    for (const k of keys) {
      if (k && data[k] !== undefined) return { key: k, value: data[k] };
    }
    return null;
  };

  const handleData = (data) => {
    if (!data || typeof data !== 'object') return;

    let screenNeedsUpdate = false;
    const rxList = resolveRxList();
    const byCanonical = { temp: [], humidity: [], aqi: [] };
    for (const row of rxList) {
      const key = String(row.key || '').trim();
      if (!key) continue;
      if (key === 'temp' || key === 'temperature' || key === 't') byCanonical.temp.push(key);
      else if (key === 'humidity' || key === 'hum' || key === 'rh') byCanonical.humidity.push(key);
      else if (key === 'aqi' || key === 'air' || key === 'mq2') byCanonical.aqi.push(key);
      // 任意配置键：有值则写入 channelValues
      if (data[key] !== undefined) {
        channelValues.value = { ...channelValues.value, [key]: data[key] };
        screenNeedsUpdate = true;
      }
    }
    // 兼容：未配置时仍认协议默认键
    for (const k of ['temp', 'humidity', 'aqi']) {
      if (!byCanonical[k].length) byCanonical[k].push(k);
    }

    const tHit = pickByKeys(data, byCanonical.temp);
    if (tHit) {
      temp.value = tHit.value;
      channelValues.value = { ...channelValues.value, temp: tHit.value, [tHit.key]: tHit.value };
      screenNeedsUpdate = true;
    }
    const hHit = pickByKeys(data, byCanonical.humidity);
    if (hHit) {
      humidity.value = hHit.value;
      channelValues.value = { ...channelValues.value, humidity: hHit.value, [hHit.key]: hHit.value };
      screenNeedsUpdate = true;
    }
    const aHit = pickByKeys(data, byCanonical.aqi);
    if (aHit) {
      aqi.value = aHit.value;
      channelValues.value = { ...channelValues.value, aqi: aHit.value, [aHit.key]: aHit.value };
      screenNeedsUpdate = true;
    }

    if (screenNeedsUpdate) {
      lastRxAt.value = Date.now();
      packetCount.value += 1;
      if (typeof pushSample === 'function') {
        pushSample({
          temp: tHit ? tHit.value : temp.value,
          humidity: hHit ? hHit.value : humidity.value,
          aqi: aHit ? aHit.value : aqi.value,
        });
      }
    }

    if (data.btn === 'CW' || data.btn === 'CCW') {
      lastRxAt.value = Date.now();
      packetCount.value += 1;
      btnState.value = `EC11 ${data.btn}`;
      addLog?.(`【硬件交互】EC11 旋钮: ${data.btn}`);

      const engine = engineRef.value;
      if (data.btn === 'CW') engine?.rotateKnob?.(1);
      else engine?.rotateKnob?.(-1);

      if (btnResetTimer) clearTimeout(btnResetTimer);
      btnResetTimer = setTimeout(() => {
        btnState.value = '未触发';
        btnResetTimer = null;
      }, 500);
    }

    const extras = { ...parseClock(data), ...parseWeather(data) };
    const breath = asOn(data.breath ?? data.breathOn ?? data.light);
    const fan = asOn(data.fan ?? data.fanOn);
    const buzzer = asOn(data.buzzer ?? data.buzzerOn ?? data.relay);
    if (breath !== null) extras.breathOn = breath;
    if (fan !== null) extras.fanOn = fan;
    if (buzzer !== null) extras.buzzerOn = buzzer;
    if (data.battery !== undefined || data.batt !== undefined) {
      const b = Number(data.battery ?? data.batt);
      extras.battery = Number.isFinite(b) ? b : null;
    }
    if (data.wifi !== undefined || data.wifiLevel !== undefined) {
      const w = Number(data.wifi ?? data.wifiLevel);
      if (Number.isFinite(w)) extras.wifiLevel = Math.max(0, Math.min(4, Math.round(w)));
    }

    if (Object.keys(extras).length) {
      lastRxAt.value = Date.now();
      packetCount.value += 1;
      hwActuators.value = {
        buzzerOn: extras.buzzerOn !== undefined ? extras.buzzerOn : hwActuators.value.buzzerOn,
        fanOn: extras.fanOn !== undefined ? extras.fanOn : hwActuators.value.fanOn,
        breathOn: extras.breathOn !== undefined ? extras.breathOn : hwActuators.value.breathOn,
        skin: hwActuators.value.skin,
        at: Date.now(),
      };
      engineRef.value?.setScreenState?.(extras);
      const bits = Object.entries(extras).map(([k, v]) => `${k}=${v}`).join(' ');
      addLog?.(`【屏同步】硬件上行刷新 · ${bits}`);
    }

    if (typeof data.skin === 'string' && data.skin.trim()) {
      const skinId = data.skin.trim();
      hwActuators.value = { ...hwActuators.value, skin: skinId, at: Date.now() };
      if (engineRef.value?.getScreenSkin?.() !== skinId) {
        const applied = engineRef.value?.setScreenSkin?.(skinId);
        addLog?.(`【屏同步】硬件上行切换皮肤 · ${applied}`);
      }
    }

    if (screenNeedsUpdate) {
      engineRef.value?.updateScreenTexture?.(temp.value, humidity.value, aqi.value);
    }
  };

  const noteParseError = (raw, err) => {
    addLog?.(`【解析失败】${err?.message || String(err)} | 原文: ${String(raw).slice(0, 120)}`);
  };

  const reset = () => {
    if (btnResetTimer) {
      clearTimeout(btnResetTimer);
      btnResetTimer = null;
    }
    temp.value = '--';
    humidity.value = '--';
    aqi.value = '--';
    channelValues.value = {};
    btnState.value = '未触发';
    lastRxAt.value = 0;
    hwActuators.value = { buzzerOn: null, fanOn: null, breathOn: null, skin: null, at: 0 };
  };

  return {
    temp,
    humidity,
    aqi,
    btnState,
    channelValues,
    lastRxAt,
    packetCount,
    hwActuators,
    handleData,
    noteParseError,
    reset,
  };
}
