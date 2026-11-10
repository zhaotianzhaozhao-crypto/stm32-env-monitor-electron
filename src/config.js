/**
 * 前端配置 — 与 shared/defaults.json / electron/config.cjs 同源。
 *
 * 【做什么】给渲染进程提供产品名、Broker 默认、主题、白名单副本、阈值默认、传感器元数据。
 * 【安全】ALLOWED_COMMANDS 仅作 UI 侧预检；真正拦截在主进程 isAllowedCommand（mqtt-manager）。
 * 【改协议】先改 shared/defaults.json，再确认 electron/config.cjs 与固件；勿只改本文件。
 * 【字段说明】见 docs/defaults字段说明.md（JSON 本身不能写注释）。
 */
import defaults from '../shared/defaults.json';
import { HARDWARE_SCENES } from './hardwareBom.js';

export const PRODUCT_NAME = defaults.productName || '环境监测';
export const PRODUCT_VERSION = defaults.version || '1.3.10';
export const APP_MODE = defaults.mode || 'demo';

/** 关于页「版本」蓝链；空字符串时仅展示样式，点击不跳转（后续填入官网/更新页） */
export const VERSION_URL = '';

/** 关于页「作者」蓝链打开的本地名片图 */
export const AUTHOR_IMAGE_SRC = './about/author.jpg';

/** 关于页「致谢」占位，后续由用户编写 */
export const ACK_TEXT = '指导老师：张建兴\nB站up主：iLx1-芷周';

/** 默认 MQTT Broker（演示模式；生产由主进程强制 mqtts + 白名单） */
export const DEFAULT_BROKER = defaults.broker?.demoUrl || 'mqtt://broker.emqx.io:1883';

/** 主题（与硬件 / 主进程约定一致，协议冻结） */
export const MQTT_TOPICS = {
  sensor: defaults.topics?.sensor || 'device/stm32/sensor_data',
  command: defaults.topics?.command || 'device/stm32/commands',
};

export const ALLOWED_COMMANDS = defaults.allowedCommands || ['buzzer:on', 'buzzer:off'];

/** 无新数据超过此时长视为设备离线（毫秒） */
export const DATA_TIMEOUT_MS = defaults.dataTimeoutMs || 8000;

/** 侧栏分段：设置 / 环境监测 / 设备控制 / 界面皮肤（= 硬件屏 LVGL 风格） */
export const PANEL_TABS = ['设置', '环境监测', '设备控制', '界面皮肤'];

/** 3D 场景：优先用 defaults.scenes；缺省则用硬件 BOM 场景表 */
export const SCENES =
  Array.isArray(defaults.scenes) && defaults.scenes.length
    ? defaults.scenes
    : HARDWARE_SCENES;

export const SKINS = defaults.skins || [
  { id: 'industrial-dark', name: '工业深色', desc: '硬件屏 LVGL 风格 · 深色半透明双卡' },
  { id: 'mist-blue', name: '雾蓝静谧', desc: '硬件屏 LVGL 风格 · 雾蓝深色' },
  { id: 'soft-home', name: '柔和家居', desc: '硬件屏 LVGL 风格 · 暖中性色家用' },
  { id: 'ops-cyan', name: '运维青金', desc: '硬件屏 LVGL 风格 · 青金监控' },
];

/** 屏显皮肤指令（与 allowedCommands 一致；固件未实现时仅孪生预览） */
export const SCREEN_SKIN_COMMANDS = (defaults.allowedCommands || []).filter((c) => String(c).startsWith('skin:'));

export const DEFAULT_THRESHOLDS = defaults.thresholds || {
  tempMin: 18,
  tempMax: 28,
  humidityMin: 40,
  humidityMax: 70,
  aqi: 100,
};

/** 传感器卡片：面向用户的简洁命名；hardware/pin 仅作次要提示 */
export const SENSOR_META = {
  temp: {
    label: '温度',
    /** 默认工作区间名；用户可在 ChartModal 改写并持久化 */
    title: '温度工作区间',
    color: '#FF9500',
    valueClass: 'temp',
    unit: '℃',
    hardware: 'DHT11',
    pin: 'PA0',
  },
  humidity: {
    label: '湿度',
    title: '湿度工作区间',
    color: '#007AFF',
    valueClass: 'hum',
    unit: '%',
    hardware: 'DHT11',
    pin: 'PA0',
  },
  aqi: {
    label: '空气质量',
    title: '空气质量工作区间',
    color: '#AF52DE',
    valueClass: 'aqi',
    unit: '',
    hardware: 'MQ-2',
    pin: 'PA1',
  },
};

/** 协议字段（硬件唯一识别口；btn 仅 CW/CCW，无 SW） */
export const SENSOR_KEYS = ['temp', 'humidity', 'aqi', 'btn'];
/** 可选上行扩展：breath/fan/buzzer/battery/wifi/skin */
export const SCREEN_STATE_KEYS = ['breath', 'fan', 'buzzer', 'battery', 'wifi', 'skin'];

/** 场景表真源在 hardwareBom.js；BOM/网格标签仅作内部参考，不再向 UI 导出 */
export { HARDWARE_SCENES } from './hardwareBom.js';
