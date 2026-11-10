/**
 * 软件配置：接收指令（上行数据通道）+ 下发指令（硬件控制）
 *
 * 【持久化】localStorage naijiaren.rxCommands / naijiaren.txCommands
 * 【接收】名称 + 格式；从格式提取 JSON 键（如 "temp":24.7 → temp）
 * 【下发】名称 + 格式整串（如 buzzer:on）；:on/:off 可配对
 * 【白名单】下发表保存后同步主进程 setAllowedCommands
 */
import { ref, computed, readonly } from 'vue';
import { ALLOWED_COMMANDS } from '../config.js';

const RX_KEY = 'naijiaren.rxCommands';
const TX_KEY = 'naijiaren.txCommands';

export const DEFAULT_RX = [
  { id: 'rx_temp', name: '温度传感器', format: '"temp":24.7' },
  { id: 'rx_humidity', name: '湿度传感器', format: '"humidity":47' },
  { id: 'rx_aqi', name: '空气质量', format: '"aqi":66' },
];

export const DEFAULT_TX = [
  { id: 'tx_buzzer_on', name: '蜂鸣开', format: 'buzzer:on' },
  { id: 'tx_buzzer_off', name: '蜂鸣关', format: 'buzzer:off' },
  { id: 'tx_fan_on', name: '风扇开', format: 'fan:on' },
  { id: 'tx_fan_off', name: '风扇关', format: 'fan:off' },
  { id: 'tx_breath_on', name: '灯光开', format: 'breath:on' },
  { id: 'tx_breath_off', name: '灯光关', format: 'breath:off' },
  { id: 'tx_skin_industrial', name: '皮肤·工业深色', format: 'skin:industrial-dark' },
  { id: 'tx_skin_mist', name: '皮肤·雾蓝', format: 'skin:mist-blue' },
  { id: 'tx_skin_soft', name: '皮肤·柔和家居', format: 'skin:soft-home' },
  { id: 'tx_skin_ops', name: '皮肤·运维青金', format: 'skin:ops-cyan' },
];

/** 从格式串提取 JSON 键名；示例值仅展示 */
export function extractJsonKey(format) {
  const s = String(format || '').trim();
  if (!s) return '';
  const m = s.match(/["']?([A-Za-z_][\w]*)["']?\s*:/);
  if (m) return m[1];
  const bare = s.match(/^([A-Za-z_][\w]*)$/);
  return bare ? bare[1] : '';
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeRxRow(row) {
  if (!row || typeof row !== 'object') return null;
  const name = String(row.name || '').trim().slice(0, 32);
  const format = String(row.format || '').trim().slice(0, 64);
  if (!name || !format) return null;
  const key = extractJsonKey(format) || String(row.key || '').trim();
  if (!key) return null;
  return {
    id: String(row.id || uid('rx')),
    name,
    format,
    key,
  };
}

function normalizeTxRow(row) {
  if (!row || typeof row !== 'object') return null;
  const name = String(row.name || '').trim().slice(0, 32);
  const format = String(row.format || '').trim().replace(/\r?\n/g, '').slice(0, 64);
  if (!name || !format) return null;
  if (/\s/.test(format)) return null;
  return {
    id: String(row.id || uid('tx')),
    name,
    format,
  };
}

function loadList(key, fallback, normalize) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback.map((r) => normalize(r)).filter(Boolean);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return fallback.map((r) => normalize(r)).filter(Boolean);
    }
    const out = parsed.map((r) => normalize(r)).filter(Boolean);
    return out.length ? out : fallback.map((r) => normalize(r)).filter(Boolean);
  } catch {
    return fallback.map((r) => normalize(r)).filter(Boolean);
  }
}

function saveList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {}
}

/** 开/关配对：buzzer:on ↔ buzzer:off */
export function pairCommand(format) {
  const f = String(format || '').trim();
  if (!f) return { on: '', off: '' };
  if (f.endsWith(':on')) {
    return { on: f, off: `${f.slice(0, -3)}:off` };
  }
  if (f.endsWith(':off')) {
    return { on: `${f.slice(0, -4)}:on`, off: f };
  }
  return { on: f, off: f };
}

/** 旋钮 / 采集卡绑定共用：去掉名称末尾开|关|on|off */
export function stripTxPolarityName(name) {
  return String(name || '')
    .trim()
    .replace(/(开|关|on|off)$/i, '')
    .replace(/[_\-\s]+$/g, '')
    .trim();
}

/** 下发格式去极性后的合并键：breath:on / breath:off → breath */
export function stripTxFormatKey(fmt) {
  return String(fmt || '')
    .trim()
    .replace(/:(on|off)$/i, '')
    .replace(/(on|off)$/i, '')
    .replace(/[_\-\s]+$/g, '')
    .trim()
    .toLowerCase();
}

/** 已知执行器族 → 排序类型 */
export function knownTxFamily(fmt) {
  const f = String(fmt || '').toLowerCase();
  if (f.startsWith('buzzer:') || f.startsWith('buzzer')) {
    return { id: 'buzzer', name: '蜂鸣器', type: 'buzzer' };
  }
  if (f.startsWith('fan:') || f.startsWith('fan')) {
    return { id: 'fan', name: '风扇', type: 'fan' };
  }
  if (f.startsWith('breath:') || f.startsWith('light:') || f.startsWith('led:')) {
    return { id: 'light', name: '灯光', type: 'light' };
  }
  return null;
}

/** 旋钮从左到右：风扇 → 灯光 → 其它 → 蜂鸣 */
export const TX_ACTUATOR_TYPE_RANK = { fan: 0, light: 1, custom: 2, buzzer: 3 };

/**
 * 下发表 → 执行设备组（开/关配对去重，与 DeviceControl / ChartModal 同源）
 * 跳过 skin:*；「灯光关」并入「灯光」，不单独占一档。
 * @returns {{ id:string, name:string, short:string, type:string, onCmd:string, offCmd:string, title:string, memberIds:string[], formats:string[] }[]}
 */
export function groupTxActuators(txRows) {
  const rows = (Array.isArray(txRows) ? txRows : []).filter((row) => {
    const f = String(row?.format || row?.cmd || '').trim();
    return f && !f.startsWith('skin:');
  });
  /** @type {Map<string, any>} */
  const map = new Map();
  for (const row of rows) {
    const fmt = String(row.format || row.cmd || '').trim();
    if (!fmt) continue;
    const name = String(row.name || row.label || fmt).trim();
    const pair = pairCommand(fmt);
    const known = knownTxFamily(fmt);
    const key = stripTxFormatKey(fmt) || String(row.id || fmt);
    const nice =
      stripTxPolarityName(name) || known?.name || name || key;
    const rowId = String(row.id || '');
    if (!map.has(key)) {
      // 稳定 id：优先 :on 行，否则首行；供绑定 / 旋钮共用
      const preferOn = /:on$/i.test(fmt) || /(开|on)$/i.test(name);
      map.set(key, {
        id: rowId || `txg:${key}`,
        name: nice,
        short: nice,
        type: known?.type || 'custom',
        onCmd: pair.on || '',
        offCmd: pair.off && pair.off !== pair.on ? pair.off : pair.off || '',
        title: `${nice} · 开/关`,
        memberIds: rowId ? [rowId] : [],
        formats: [fmt],
        _order: map.size,
        _key: key,
        _hasOnRow: !!preferOn,
      });
    } else {
      const g = map.get(key);
      if (rowId && !g.memberIds.includes(rowId)) g.memberIds.push(rowId);
      if (!g.formats.includes(fmt)) g.formats.push(fmt);
      if (pair.on && (!g.onCmd || g.onCmd === g.offCmd)) g.onCmd = pair.on;
      if (pair.off && pair.off !== pair.on && !g.offCmd) g.offCmd = pair.off;
      const preferOn = /:on$/i.test(fmt) || /(开|on)$/i.test(name);
      if (preferOn && rowId) {
        g.id = rowId;
        g._hasOnRow = true;
      } else if (!g._hasOnRow && rowId && !g.id) {
        g.id = rowId;
      }
      if (nice && (!g.name || nice.length <= String(g.name).length)) {
        g.name = nice;
        g.short = nice;
        g.title = `${nice} · 开/关`;
      }
      if (known?.type && g.type === 'custom') g.type = known.type;
    }
  }
  return [...map.values()]
    .map((g) => {
      if (!g.onCmd && g.offCmd) {
        const p = pairCommand(g.offCmd);
        g.onCmd = p.on || g.onCmd;
      }
      if (!g.offCmd && g.onCmd) {
        const p = pairCommand(g.onCmd);
        if (p.off && p.off !== p.on) g.offCmd = p.off;
      }
      return g;
    })
    .filter((g) => g.onCmd || g.offCmd)
    .sort((a, b) => {
      const ra = TX_ACTUATOR_TYPE_RANK[a.type] ?? TX_ACTUATOR_TYPE_RANK.custom;
      const rb = TX_ACTUATOR_TYPE_RANK[b.type] ?? TX_ACTUATOR_TYPE_RANK.custom;
      if (ra !== rb) return ra - rb;
      return a._order - b._order;
    })
    .map(({ _order, _key, _hasOnRow, ...g }) => g);
}

/** 在分组列表里按绑定 id（组 id 或开/关行 id）定位 */
export function findTxActuatorGroup(groups, deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return null;
  const list = Array.isArray(groups) ? groups : [];
  return (
    list.find((g) => g.id === id) ||
    list.find((g) => (g.memberIds || []).includes(id)) ||
    null
  );
}

/**
 * 从 localStorage 读下发格式（供 useDevices 白名单合并，无 Vue 实例时可用）
 */
export function readTxFormatsFromStorage() {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return DEFAULT_TX.map((r) => r.format);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TX.map((r) => r.format);
    return parsed
      .map((r) => String(r?.format || '').trim())
      .filter((f) => f && !/\s/.test(f));
  } catch {
    return DEFAULT_TX.map((r) => r.format);
  }
}

export function readRxFromStorage() {
  return loadList(RX_KEY, DEFAULT_RX, normalizeRxRow);
}

export function useSoftConfig({
  electronAPI = (typeof window !== 'undefined' && window.electronAPI) || {},
  addLog,
} = {}) {
  const rxCommands = ref(loadList(RX_KEY, DEFAULT_RX, normalizeRxRow));
  const txCommands = ref(loadList(TX_KEY, DEFAULT_TX, normalizeTxRow));
  const saveHint = ref('');

  const rxOptions = computed(() =>
    rxCommands.value.map((r) => ({
      id: r.id,
      name: r.name,
      key: r.key,
      format: r.format,
      label: r.name,
    }))
  );

  const txOptions = computed(() =>
    txCommands.value.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      label: t.name,
    }))
  );

  /** 开/关去重后的执行设备组（旋钮 + 采集卡绑定同源，随 txCommands 实时刷新） */
  const actuatorGroups = computed(() => groupTxActuators(txCommands.value));

  const allowedFromTx = computed(() => {
    const set = new Set(
      (ALLOWED_COMMANDS || []).map((c) => String(c))
    );
    for (const t of txCommands.value) {
      if (t.format) set.add(t.format);
      const pair = pairCommand(t.format);
      if (pair.on) set.add(pair.on);
      if (pair.off) set.add(pair.off);
    }
    return Array.from(set);
  });

  const syncWhitelistToMain = (list) => {
    const cmds = Array.isArray(list) ? list : allowedFromTx.value;
    try {
      electronAPI.setAllowedCommands?.(cmds);
    } catch (e) {
      addLog?.(`【软件配置】同步白名单失败: ${e?.message || e}`);
    }
  };

  const persistRx = () => {
    saveList(RX_KEY, rxCommands.value);
  };

  const persistTx = () => {
    saveList(TX_KEY, txCommands.value);
    syncWhitelistToMain(allowedFromTx.value);
  };

  const saveRx = (rows) => {
    const next = (Array.isArray(rows) ? rows : [])
      .map((r) => normalizeRxRow(r))
      .filter(Boolean);
    if (!next.length) {
      saveHint.value = '接收指令至少保留一条有效「名称+格式」';
      return false;
    }
    rxCommands.value = next;
    persistRx();
    saveHint.value = `已保存接收指令 ${next.length} 条`;
    addLog?.(`【软件配置】已保存接收指令 ${next.length} 条`);
    return true;
  };

  const saveTx = (rows) => {
    const next = (Array.isArray(rows) ? rows : [])
      .map((r) => normalizeTxRow(r))
      .filter(Boolean);
    if (!next.length) {
      saveHint.value = '下发指令至少保留一条有效「名称+格式」';
      return false;
    }
    txCommands.value = next;
    persistTx();
    saveHint.value = `已保存下发指令 ${next.length} 条（已同步白名单）`;
    addLog?.(`【软件配置】已保存下发指令 ${next.length} 条，白名单 ${allowedFromTx.value.length} 条`);
    return true;
  };

  const resetRxDefaults = () => {
    rxCommands.value = DEFAULT_RX.map((r) => normalizeRxRow(r)).filter(Boolean);
    persistRx();
    saveHint.value = '已恢复默认接收指令';
    addLog?.('【软件配置】恢复默认接收指令');
  };

  const resetTxDefaults = () => {
    txCommands.value = DEFAULT_TX.map((r) => normalizeTxRow(r)).filter(Boolean);
    persistTx();
    saveHint.value = '已恢复默认下发指令';
    addLog?.('【软件配置】恢复默认下发指令');
  };

  const getRxById = (id) => rxCommands.value.find((r) => r.id === id) || null;
  const getRxByKey = (key) => rxCommands.value.find((r) => r.key === key) || null;
  const getTxById = (id) => txCommands.value.find((t) => t.id === id) || null;

  const hasTx = (id) => {
    if (txCommands.value.some((t) => t.id === id)) return true;
    return !!findTxActuatorGroup(actuatorGroups.value, id);
  };

  /** 解析通道：支持 rx id 或裸 key */
  const resolveChannelKey = (channel) => {
    const c = String(channel || '').trim();
    if (!c) return '';
    const byId = getRxById(c);
    if (byId) return byId.key;
    return c;
  };

  /** 报警/下发：按 TX 行 id 或分组内开|关行 取开/关指令 */
  const getTxCommandPair = (txId) => {
    const id = String(txId || '').trim();
    if (!id) return null;
    const g = findTxActuatorGroup(actuatorGroups.value, id);
    if (g) {
      return {
        on: g.onCmd || '',
        off: g.offCmd || '',
        name: g.name,
        format: g.onCmd || g.offCmd || '',
      };
    }
    const row = getTxById(id);
    if (!row) return null;
    return {
      ...pairCommand(row.format),
      name: stripTxPolarityName(row.name) || row.name,
      format: row.format,
    };
  };

  const getTxCommandsForAlarm = (txId) => {
    const pair = getTxCommandPair(txId);
    if (!pair) return [];
    const out = [];
    if (pair.on) out.push(pair.on);
    if (pair.off && pair.off !== pair.on) out.push(pair.off);
    return out;
  };

  const getTxName = (txId) => {
    const g = findTxActuatorGroup(actuatorGroups.value, txId);
    if (g) return g.name;
    const raw = getTxById(txId)?.name || '';
    return stripTxPolarityName(raw) || raw;
  };

  /** 启动时把本地下发表推到主进程 */
  const bootstrapWhitelist = () => {
    syncWhitelistToMain(allowedFromTx.value);
  };

  return {
    rxCommands,
    txCommands,
    rxOptions,
    txOptions,
    actuatorGroups,
    allowedFromTx,
    saveHint: readonly(saveHint),
    saveRx,
    saveTx,
    resetRxDefaults,
    resetTxDefaults,
    getRxById,
    getRxByKey,
    getTxById,
    hasTx,
    resolveChannelKey,
    getTxCommandPair,
    getTxCommandsForAlarm,
    getTxName,
    bootstrapWhitelist,
    syncWhitelistToMain,
    extractJsonKey,
    DEFAULT_RX,
    DEFAULT_TX,
  };
}
