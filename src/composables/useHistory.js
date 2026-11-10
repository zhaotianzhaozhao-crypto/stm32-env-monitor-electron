/**
 * 传感器历史采样（内存 + localStorage）
 *
 * 【容量】最多 MAX_POINTS=500；滚动丢弃 24h 以前。
 * 【节流】MIN_INTERVAL_MS=1s；同值且 <5s 跳过，满 5s 仍记一笔保曲线。
 * 【键】naijiaren_sensor_history；图表经 getHistory(type) 取 times+data。
 */
import { ref, readonly } from 'vue';

const MAX_POINTS = 500;
const STORAGE_KEY = 'naijiaren_sensor_history';
/** 两条采样最小间隔（毫秒），避免 1 秒内刷爆 */
const MIN_INTERVAL_MS = 1000;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { times: [], temp: [], humidity: [], aqi: [], timestamps: [] };
    }
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const times = [];
    const temp = [];
    const humidity = [];
    const aqi = [];
    const timestamps = [];
    const srcTimes = parsed.times || [];
    const srcTs = parsed.timestamps || [];
    for (let i = 0; i < srcTimes.length; i++) {
      // 无 timestamp 的旧数据：保留（用当前时间倒推，避免整表被清空）
      const ts = srcTs[i] != null ? Number(srcTs[i]) : cutoff + i;
      if (ts >= cutoff) {
        times.push(srcTimes[i]);
        temp.push(parsed.temp?.[i] ?? null);
        humidity.push(parsed.humidity?.[i] ?? null);
        aqi.push(parsed.aqi?.[i] ?? null);
        timestamps.push(ts);
      }
    }
    return { times, temp, humidity, aqi, timestamps };
  } catch {
    return { times: [], temp: [], humidity: [], aqi: [], timestamps: [] };
  }
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function useHistory() {
  const initial = loadFromStorage();
  const times = ref(initial.times || []);
  const tempHistory = ref(initial.temp || []);
  const humidityHistory = ref(initial.humidity || []);
  const aqiHistory = ref(initial.aqi || []);
  const timestamps = ref(initial.timestamps || []);

  const formatTime = (date = new Date()) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  /**
   * 追加一条传感器采样
   * - 数值可以是 number 或数字字符串
   * - 至少间隔 MIN_INTERVAL_MS
   * - 同秒内数值完全不变则跳过
   */
  const pushSample = ({ temp, humidity, aqi }) => {
    const toNum = (v) => {
      if (v === undefined || v === null || v === '--' || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const t = toNum(temp);
    const h = toNum(humidity);
    const a = toNum(aqi);
    if (t === null && h === null && a === null) return;

    const now = new Date();
    const nowMs = now.getTime();
    const lastIdx = times.value.length - 1;

    if (lastIdx >= 0) {
      const dt = nowMs - (timestamps.value[lastIdx] || 0);
      if (dt < MIN_INTERVAL_MS) return;

      const sameT = t === null || tempHistory.value[lastIdx] === t;
      const sameH = h === null || humidityHistory.value[lastIdx] === h;
      const sameA = a === null || aqiHistory.value[lastIdx] === a;
      // 数值全不变且不足 5 秒，跳过；满 5 秒仍记一笔，保证曲线有点
      if (sameT && sameH && sameA && dt < 5000) return;
    }

    const label = formatTime(now);
    times.value.push(label);
    timestamps.value.push(nowMs);
    tempHistory.value.push(t ?? (lastIdx >= 0 ? tempHistory.value[lastIdx] : 0));
    humidityHistory.value.push(h ?? (lastIdx >= 0 ? humidityHistory.value[lastIdx] : 0));
    aqiHistory.value.push(a ?? (lastIdx >= 0 ? aqiHistory.value[lastIdx] : 0));

    if (times.value.length > MAX_POINTS) {
      const excess = times.value.length - MAX_POINTS;
      times.value.splice(0, excess);
      timestamps.value.splice(0, excess);
      tempHistory.value.splice(0, excess);
      humidityHistory.value.splice(0, excess);
      aqiHistory.value.splice(0, excess);
    }

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    while (timestamps.value.length && timestamps.value[0] < cutoff) {
      times.value.shift();
      timestamps.value.shift();
      tempHistory.value.shift();
      humidityHistory.value.shift();
      aqiHistory.value.shift();
    }

    saveToStorage({
      times: times.value,
      temp: tempHistory.value,
      humidity: humidityHistory.value,
      aqi: aqiHistory.value,
      timestamps: timestamps.value,
    });
  };

  const canonicalType = (raw) => {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'temp' || k === 'temperature' || k === 't') return 'temp';
    if (k === 'humidity' || k === 'hum' || k === 'rh') return 'humidity';
    if (k === 'aqi' || k === 'air' || k === 'mq2') return 'aqi';
    return k;
  };

  const getHistory = (type) => {
    const key = canonicalType(type);
    const map = {
      temp: tempHistory.value,
      humidity: humidityHistory.value,
      aqi: aqiHistory.value,
    };
    return {
      times: [...times.value],
      data: [...(map[key] || [])],
    };
  };

  /** 全量对齐序列（导出 / 调试用） */
  const getAllSeries = () => ({
    times: [...times.value],
    timestamps: [...timestamps.value],
    temp: [...tempHistory.value],
    humidity: [...humidityHistory.value],
    aqi: [...aqiHistory.value],
  });

  /**
   * 导出用行：时间、ISO 时间戳、温/湿/AQI
   * @returns {{ time: string, iso: string, temp: number|null, humidity: number|null, aqi: number|null }[]}
   */
  const getExportRows = () => {
    const n = times.value.length;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const ts = timestamps.value[i];
      let iso = '';
      if (ts != null && Number.isFinite(Number(ts))) {
        try {
          iso = new Date(Number(ts)).toISOString();
        } catch {
          iso = '';
        }
      }
      rows.push({
        time: times.value[i] ?? '',
        iso,
        temp: tempHistory.value[i] ?? null,
        humidity: humidityHistory.value[i] ?? null,
        aqi: aqiHistory.value[i] ?? null,
      });
    }
    return rows;
  };

  return {
    pushSample,
    getHistory,
    getAllSeries,
    getExportRows,
    times: readonly(times),
    pointCount: () => times.value.length,
  };
}
