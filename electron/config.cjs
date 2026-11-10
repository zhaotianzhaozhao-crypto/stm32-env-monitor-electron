/**
 * 主进程配置 — 单一真源：shared/defaults.json
 *
 * 【做什么】加载 defaults；导出 Broker/主题/白名单；validateBrokerUrl / isAllowedCommand。
 * 【模式】NAIJIAREN_MODE 或 defaults.mode；production 强制 mqtts/wss + allowedHosts。
 * 【禁止】渲染进程绕过本模块直连任意 Broker；演示可改 URL 但仍过 validateBrokerUrl。
 * 【字段说明】docs/defaults字段说明.md
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function loadDefaults() {
  const candidates = [
    path.join(__dirname, '..', 'shared', 'defaults.json'),
    path.join(process.resourcesPath || '', 'shared', 'defaults.json'),
    path.join(app?.getAppPath?.() || '', 'shared', 'defaults.json'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (_) {}
  }
  // 兜底（不应走到）
  return {
    mode: 'demo',
    broker: {
      demoUrl: 'mqtt://broker.emqx.io:1883',
      allowedHosts: ['broker.emqx.io', 'localhost', '127.0.0.1'],
      requireTlsInProduction: true,
      allowedSchemesDemo: ['mqtt', 'mqtts', 'ws', 'wss'],
      allowedSchemesProduction: ['mqtts', 'wss'],
    },
    topics: {
      sensor: 'device/stm32/sensor_data',
      command: 'device/stm32/commands',
    },
    allowedCommands: ['buzzer:on', 'buzzer:off', 'breath:on', 'breath:off', 'fan:on', 'fan:off', 'skin:industrial-dark', 'skin:mist-blue', 'skin:soft-home', 'skin:ops-cyan'],
  };
}

const defaults = loadDefaults();

const BROKER_URL = defaults.broker?.demoUrl || 'mqtt://broker.emqx.io:1883';
const SENSOR_TOPIC = defaults.topics?.sensor || 'device/stm32/sensor_data';
const COMMAND_TOPIC = defaults.topics?.command || 'device/stm32/commands';
const DEFAULT_ALLOWED_COMMANDS = defaults.allowedCommands || ['buzzer:on', 'buzzer:off', 'breath:on', 'breath:off', 'fan:on', 'fan:off', 'skin:industrial-dark', 'skin:mist-blue', 'skin:soft-home', 'skin:ops-cyan'];
const ALLOWED_COMMANDS = new Set(DEFAULT_ALLOWED_COMMANDS);
/** 固定指令底座：渲染进程只能追加、不能移除（buzzer:on/off 等基础指令是报警输出依赖） */
const FIXED_ALLOWED_COMMANDS = new Set(DEFAULT_ALLOWED_COMMANDS);
const APP_MODE = (process.env.NAIJIAREN_MODE || defaults.mode || 'demo').toLowerCase();

function parseBrokerUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    // mqtt(s):// host 兼容 URL 解析
    const normalized = s.replace(/^mqtts:/i, 'https:').replace(/^mqtt:/i, 'http:')
      .replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
    const u = new URL(normalized);
    const schemeMatch = s.match(/^([a-z0-9]+):/i);
    const scheme = (schemeMatch ? schemeMatch[1] : 'mqtt').toLowerCase();
    return { scheme, host: u.hostname.toLowerCase(), port: u.port, href: s };
  } catch (_) {
    return null;
  }
}

function validateBrokerUrl(raw) {
  const parsed = parseBrokerUrl(raw);
  if (!parsed) return { ok: false, reason: 'Broker 地址无效' };

  const isProd = APP_MODE === 'production' || APP_MODE === 'prod';
  const schemes = isProd
    ? (defaults.broker?.allowedSchemesProduction || ['mqtts', 'wss'])
    : (defaults.broker?.allowedSchemesDemo || ['mqtt', 'mqtts', 'ws', 'wss']);

  if (!schemes.includes(parsed.scheme)) {
    return {
      ok: false,
      reason: isProd
        ? `生产模式仅允许 ${schemes.join('/')}（当前 ${parsed.scheme}）`
        : `不允许的协议：${parsed.scheme}`,
    };
  }

  const hosts = (defaults.broker?.allowedHosts || []).map((h) => h.toLowerCase());
  if (hosts.length && !hosts.includes(parsed.host)) {
    return { ok: false, reason: `主机不在允许列表：${parsed.host}` };
  }

  if (isProd && defaults.broker?.requireTlsInProduction) {
    if (!['mqtts', 'wss'].includes(parsed.scheme)) {
      return { ok: false, reason: '生产模式必须使用 TLS（mqtts/wss）' };
    }
  }

  return { ok: true, url: parsed.href, parsed, mode: isProd ? 'production' : 'demo' };
}

function normalizeCommand(cmd) {
  return String(cmd || '').trim().replace(/\r?\n$/g, '');
}

function isAllowedCommand(cmd) {
  return ALLOWED_COMMANDS.has(normalizeCommand(cmd));
}

/**
 * 渲染进程「软件配置·下发指令」保存后热更新白名单。
 * 安全：固定底座指令不可被移除，只能追加自定义指令；空/非法输入不改变现状。
 */
function setAllowedCommands(list) {
  if (!Array.isArray(list)) return Array.from(ALLOWED_COMMANDS);
  const merged = new Set(FIXED_ALLOWED_COMMANDS);
  const seen = new Set();
  for (const c of list) {
    const s = normalizeCommand(c);
    if (!s || s.length > 64 || /\s/.test(s) || seen.has(s)) continue;
    seen.add(s);
    merged.add(s);
    if (merged.size >= 128) break;
  }
  ALLOWED_COMMANDS.clear();
  for (const s of merged) ALLOWED_COMMANDS.add(s);
  return Array.from(merged);
}

/**
 * 基本 Topic 合法性（订阅/发布共用）
 * - 非空、长度 ≤ 256
 * - 不含空字符、空白、MQTT 通配符 +/#（本应用用精确主题）
 * - 不以 $ 开头（系统主题）
 */
function validateTopic(raw, label = 'Topic') {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, reason: `${label} 不能为空` };
  if (s.length > 256) return { ok: false, reason: `${label} 过长（最多 256）` };
  if (/[\u0000\s]/.test(s)) return { ok: false, reason: `${label} 不能含空白或空字符` };
  if (/[+#]/.test(s)) return { ok: false, reason: `${label} 不支持通配符 +/#` };
  if (s.startsWith('$')) return { ok: false, reason: `${label} 不能使用系统主题（$ 开头）` };
  if (s.includes('//')) return { ok: false, reason: `${label} 不能含空层级 //` };
  return { ok: true, topic: s };
}

module.exports = {
  defaults,
  BROKER_URL,
  SENSOR_TOPIC,
  COMMAND_TOPIC,
  ALLOWED_COMMANDS,
  APP_MODE,
  validateBrokerUrl,
  validateTopic,
  normalizeCommand,
  isAllowedCommand,
  setAllowedCommands,
};
