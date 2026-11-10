/**
 * 用户设备列表（趋势弹窗「设备」下拉 + 设备控制面板同一数据源）
 *
 * 【做什么】维护设备清单；默认设备首次 seed；用户新增须自定名称；每台可挂白名单 MQTT 下行。
 * 【持久化】localStorage `naijiaren.devices`
 * 【协议】发送走 electronAPI.sendCommand → 主进程 allowedCommands；UI 仅勾选白名单。
 * 【数据结构】{ id, name, type, commands: string[], builtin?: boolean }
 * 【改时注意】删设备时调用方须 rebind 工作区间；builtin 默认项不可删。
 */
import { ref, readonly } from 'vue';
import { ALLOWED_COMMANDS } from '../config.js';

const STORAGE_KEY = 'naijiaren.devices';

/** 指令中文短名（仅展示；真值仍是协议串） */
export const COMMAND_LABELS = {
  'buzzer:on': '蜂鸣开',
  'buzzer:off': '蜂鸣关',
  'breath:on': '灯光开',
  'breath:off': '灯光关',
  'fan:on': '风扇开',
  'fan:off': '风扇关',
  'skin:industrial-dark': '皮肤·工业深色',
  'skin:mist-blue': '皮肤·雾蓝',
  'skin:soft-home': '皮肤·柔和家居',
  'skin:ops-cyan': '皮肤·运维青金',
};

/**
 * 硬件角色（用于「添加时选角色带默认指令」+ 展示标签）
 * 不是「点一下再添加一台温度传感」——默认传感已在 seed 里。
 */
export const DEVICE_TEMPLATES = [
  {
    type: 'temp',
    label: '温度传感',
    defaultName: '温度传感',
    kind: 'sensor',
    hint: '供环境卡 / 趋势绑定；通常无下行',
    defaultCommands: [],
  },
  {
    type: 'humidity',
    label: '湿度传感',
    defaultName: '湿度传感',
    kind: 'sensor',
    hint: '供环境卡 / 趋势绑定；通常无下行',
    defaultCommands: [],
  },
  {
    type: 'aqi',
    label: '空气质量',
    defaultName: '空气质量',
    kind: 'sensor',
    hint: '供环境卡 / 趋势绑定；通常无下行',
    defaultCommands: [],
  },
  {
    type: 'buzzer',
    label: '蜂鸣',
    defaultName: '蜂鸣器',
    kind: 'actuator',
    hint: '报警输出 · buzzer:on/off',
    defaultCommands: ['buzzer:on', 'buzzer:off'],
  },
  {
    type: 'fan',
    label: '风扇',
    defaultName: '风扇',
    kind: 'actuator',
    hint: '风扇开关 · fan:on/off',
    defaultCommands: ['fan:on', 'fan:off'],
  },
  {
    type: 'light',
    label: '灯光',
    defaultName: '灯光',
    kind: 'actuator',
    hint: '呼吸灯开关 · breath:on/off',
    defaultCommands: ['breath:on', 'breath:off'],
  },
  {
    type: 'button',
    label: '按键',
    defaultName: '按键/编码器',
    kind: 'sensor',
    hint: '上行 btn（CW/CCW）；通常无下行',
    defaultCommands: [],
  },
  {
    type: 'custom',
    label: '自定义',
    defaultName: '新设备',
    kind: 'custom',
    hint: '自定名称；自行勾选下行指令',
    defaultCommands: [],
  },
];

/** 首次 seed / 迁移保证存在的默认角色 */
export const BUILTIN_SEED_TYPES = ['temp', 'humidity', 'aqi', 'buzzer', 'fan', 'light'];

const TEMPLATE_MAP = Object.fromEntries(DEVICE_TEMPLATES.map((t) => [t.type, t]));

/** 白名单副本（渲染用）；合并软件配置·下发指令；缺省兜底 */
export function listAllowedCommands() {
  const list = Array.isArray(ALLOWED_COMMANDS) ? ALLOWED_COMMANDS.slice() : [];
  try {
    const raw = localStorage.getItem('naijiaren.txCommands');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const f = String(row?.format || '').trim();
          if (f && !/\s/.test(f)) list.push(f);
        }
      }
    }
  } catch (_) {}
  const out = [];
  const seen = new Set();
  for (const c of list) {
    const s = String(c || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length ? out : ['buzzer:on', 'buzzer:off'];
}

export function commandLabel(cmd) {
  return COMMAND_LABELS[cmd] || cmd;
}

export function typeLabel(type) {
  return TEMPLATE_MAP[type]?.label || '自定义';
}

export function typeKind(type) {
  return TEMPLATE_MAP[type]?.kind || 'custom';
}

function uid() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 只保留白名单内指令；未知串丢弃（避免配了发不出） */
function normalizeCommands(raw) {
  const allow = new Set(listAllowedCommands());
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const c of raw) {
    const s = String(c || '').trim().slice(0, 64);
    if (!s || seen.has(s) || !allow.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 32) break;
  }
  return out;
}

function inferType(d) {
  if (d?.type && TEMPLATE_MAP[d.type]) return d.type;
  const cmds = Array.isArray(d?.commands) ? d.commands : [];
  if (cmds.some((c) => String(c).startsWith('fan:'))) return 'fan';
  if (cmds.some((c) => String(c).startsWith('breath:'))) return 'light';
  if (cmds.some((c) => String(c).startsWith('buzzer:'))) return 'buzzer';
  if (cmds.some((c) => String(c).startsWith('skin:'))) return 'light';
  return 'custom';
}

function normalizeDevice(d) {
  if (!d || typeof d !== 'object' || !d.id) return null;
  const name = String(d.name || '').trim().slice(0, 32);
  if (!name) return null;
  const type = inferType(d);
  return {
    id: String(d.id),
    name,
    type,
    commands: normalizeCommands(d.commands),
    builtin: !!d.builtin,
  };
}

function makeBuiltin(type) {
  const tpl = TEMPLATE_MAP[type];
  return {
    id: `dev_builtin_${type}`,
    name: tpl.defaultName,
    type,
    commands: normalizeCommands(tpl.defaultCommands),
    builtin: true,
  };
}

function loadDevices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const list = parsed.map(normalizeDevice).filter(Boolean);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

function saveDevices(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/** 首次无数据：种传感 + 蜂鸣/风扇/灯光（全部 builtin） */
function seedDefault() {
  return BUILTIN_SEED_TYPES.map(makeBuiltin);
}

/**
 * 迁移旧数据：
 * - 若没有任何 builtin，把各 seed 角色的第一台标成默认
 * - 缺的 seed 角色补上 builtin
 */
function migrateBuiltins(list) {
  let next = list.map((d) => ({ ...d }));
  const hasAnyBuiltin = next.some((d) => d.builtin);

  if (!hasAnyBuiltin) {
    for (const t of BUILTIN_SEED_TYPES) {
      const i = next.findIndex((d) => d.type === t);
      if (i >= 0) next[i] = { ...next[i], builtin: true };
    }
  }

  for (const t of BUILTIN_SEED_TYPES) {
    if (!next.some((d) => d.type === t && d.builtin)) {
      const i = next.findIndex((d) => d.type === t);
      if (i >= 0) next[i] = { ...next[i], builtin: true };
      else next = [...next, makeBuiltin(t)];
    }
  }
  return next;
}

export function useDevices() {
  const stored = loadDevices();
  const initial = stored && stored.length ? migrateBuiltins(stored) : seedDefault();
  const devices = ref(initial);
  saveDevices(devices.value);

  const persist = () => saveDevices(devices.value);

  /**
   * 添加用户设备（须自定名称）。
   * @param {string|{ name: string, type?: string, commands?: string[] }} nameOrOpts
   * @param {string} [typeMaybe] 当第一参为名称字符串时的角色
   * @returns {object|null} 新设备；名称为空则 null
   */
  const addDevice = (nameOrOpts = {}, typeMaybe) => {
    let type = 'custom';
    let name = '';
    let commands;

    if (typeof nameOrOpts === 'string') {
      name = String(nameOrOpts).trim().slice(0, 32);
      type = String(typeMaybe || 'custom');
    } else if (nameOrOpts && typeof nameOrOpts === 'object') {
      name = String(nameOrOpts.name || '').trim().slice(0, 32);
      type = String(nameOrOpts.type || 'custom');
      if (Array.isArray(nameOrOpts.commands)) commands = nameOrOpts.commands;
    }

    if (!name) return null;

    const tpl = TEMPLATE_MAP[type] || TEMPLATE_MAP.custom;
    if (!TEMPLATE_MAP[type]) type = 'custom';

    const d = {
      id: uid(),
      name,
      type,
      commands: normalizeCommands(
        commands != null ? commands : (tpl.defaultCommands || []).slice()
      ),
      builtin: false,
    };
    devices.value = [...devices.value, d];
    persist();
    return d;
  };

  const renameDevice = (id, name) => {
    const n = String(name || '').trim().slice(0, 32);
    if (!n) return false;
    const i = devices.value.findIndex((d) => d.id === id);
    if (i < 0) return false;
    const next = devices.value.slice();
    next[i] = { ...next[i], name: n };
    devices.value = next;
    persist();
    return true;
  };

  /** 覆盖指令列表（自动滤白名单） */
  const setDeviceCommands = (id, commands) => {
    const i = devices.value.findIndex((d) => d.id === id);
    if (i < 0) return false;
    const next = devices.value.slice();
    next[i] = { ...next[i], commands: normalizeCommands(commands) };
    devices.value = next;
    persist();
    return true;
  };

  /**
   * 删除设备。builtin 默认项不可删。
   * @returns {{ removed: boolean, fallbackId: string|null, reason?: string }}
   */
  const removeDevice = (id) => {
    const target = devices.value.find((d) => d.id === id);
    if (!target) {
      return { removed: false, fallbackId: devices.value[0]?.id || null, reason: 'missing' };
    }
    if (target.builtin) {
      return {
        removed: false,
        fallbackId: target.id,
        reason: 'builtin',
      };
    }
    if (devices.value.length <= 1) {
      return { removed: false, fallbackId: devices.value[0]?.id || null, reason: 'last' };
    }
    devices.value = devices.value.filter((d) => d.id !== id);
    // 删光用户项后若意外空了，补种子
    if (!devices.value.length) {
      devices.value = seedDefault();
    }
    persist();
    return { removed: true, fallbackId: devices.value[0]?.id || null };
  };

  const getName = (id) => {
    const d = devices.value.find((x) => x.id === id);
    return d?.name || '未命名设备';
  };

  const getCommands = (id) => {
    const d = devices.value.find((x) => x.id === id);
    return d?.commands ? d.commands.slice() : [];
  };

  const getType = (id) => {
    const d = devices.value.find((x) => x.id === id);
    return d?.type || 'custom';
  };

  const has = (id) => devices.value.some((d) => d.id === id);

  const getDefaultDeviceId = () => {
    const b = devices.value.find((d) => d.builtin);
    return b?.id || devices.value[0]?.id || '';
  };

  /** 按角色找第一台（优先 builtin），供工作区间默认绑定 */
  const findIdByType = (type) => {
    const list = devices.value;
    const b = list.find((d) => d.type === type && d.builtin);
    if (b) return b.id;
    const any = list.find((d) => d.type === type);
    return any?.id || '';
  };

  return {
    devices: readonly(devices),
    addDevice,
    renameDevice,
    removeDevice,
    setDeviceCommands,
    getName,
    getCommands,
    getType,
    has,
    getDefaultDeviceId,
    findIdByType,
    DEVICE_TEMPLATES,
    listAllowedCommands,
    /** 可变引用：仅内部迁移 / 测试用 */
    _devices: devices,
  };
}
