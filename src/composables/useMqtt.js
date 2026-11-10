/**
 * MQTT 渲染侧封装（不直连 Broker，一律走 electronAPI → 主进程）
 *
 * 【状态机】connectionStatus 字符串：未连接 / 正在连接云端… / 已连接 / 重连中... / 已断开 / 连接出错
 * 【依赖注入】electronAPI、storage 可 mock，便于单测。
 * 【注意】「已连接」= 电脑连上 Broker，≠ 设备在线（设备看 useDeviceHealth.dataOnline）。
 * 【可改】Broker URL、上行 Topic、下行 Topic（localStorage 持久化；改后需重连生效）。
 */
import { ref, computed } from 'vue';
import { DEFAULT_BROKER, MQTT_TOPICS } from '../config.js';

const STORAGE_KEY_BROKER = 'naijiaren.brokerUrl';
const STORAGE_KEY_SENSOR = 'naijiaren.sensorTopic';
const STORAGE_KEY_COMMAND = 'naijiaren.commandTopic';

function readStored(storage, key, fallback) {
  try {
    const v = storage?.getItem?.(key);
    if (v != null && String(v).trim()) return String(v).trim();
  } catch (_) {}
  return fallback;
}

/** 渲染侧 Topic 预检（最终以主进程 validateTopic 为准） */
export function validateTopicClient(raw, label = 'Topic') {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, reason: `${label} 不能为空` };
  if (s.length > 256) return { ok: false, reason: `${label} 过长（最多 256）` };
  if (/[\u0000\s]/.test(s)) return { ok: false, reason: `${label} 不能含空白或空字符` };
  if (/[+#]/.test(s)) return { ok: false, reason: `${label} 不支持通配符 +/#` };
  if (s.startsWith('$')) return { ok: false, reason: `${label} 不能使用系统主题（$ 开头）` };
  if (s.includes('//')) return { ok: false, reason: `${label} 不能含空层级 //` };
  return { ok: true, topic: s };
}

export function useMqtt({
  electronAPI = (typeof window !== 'undefined' && window.electronAPI) || {},
  storage = (typeof window !== 'undefined' && window.localStorage) || null,
} = {}) {
  // 连接状态机：用一个字符串表达全部状态（未连接/握手中/已连接/重连中/已断开/连接出错）。
  // 判断「是否在 Electron 中运行」看 electronAPI 有没有 connectBroker 方法即可。
  const connectionStatus = ref(
    electronAPI.connectBroker ? '未连接' : '需在 Electron 中运行'
  );
  // 从 localStorage 恢复上次用过的 Broker / Topic，记不住就用 defaults
  const brokerUrl = ref(readStored(storage, STORAGE_KEY_BROKER, DEFAULT_BROKER));
  const sensorTopic = ref(
    readStored(storage, STORAGE_KEY_SENSOR, MQTT_TOPICS.sensor || 'device/stm32/sensor_data')
  );
  const commandTopic = ref(
    readStored(storage, STORAGE_KEY_COMMAND, MQTT_TOPICS.command || 'device/stm32/commands')
  );

  const isConnected = computed(() => connectionStatus.value === '已连接');
  const isBusy = computed(() =>
    ['握手中...', '正在连接云端…', '重连中...'].includes(connectionStatus.value)
  );

  const persist = () => {
    try {
      storage?.setItem?.(STORAGE_KEY_BROKER, (brokerUrl.value || DEFAULT_BROKER).trim());
      storage?.setItem?.(STORAGE_KEY_SENSOR, (sensorTopic.value || MQTT_TOPICS.sensor).trim());
      storage?.setItem?.(STORAGE_KEY_COMMAND, (commandTopic.value || MQTT_TOPICS.command).trim());
    } catch (_) {}
  };

  const connect = () => {
    if (!electronAPI.connectBroker) {
      connectionStatus.value = '需在 Electron 中运行';
      return;
    }
    const url = (brokerUrl.value || DEFAULT_BROKER).trim();
    const up = validateTopicClient(sensorTopic.value || MQTT_TOPICS.sensor, '上行 Topic');
    const down = validateTopicClient(commandTopic.value || MQTT_TOPICS.command, '下行 Topic');
    if (!up.ok) {
      connectionStatus.value = '连接出错';
      console.warn('[mqtt]', up.reason);
      return { ok: false, reason: up.reason };
    }
    if (!down.ok) {
      connectionStatus.value = '连接出错';
      console.warn('[mqtt]', down.reason);
      return { ok: false, reason: down.reason };
    }
    sensorTopic.value = up.topic;
    commandTopic.value = down.topic;
    brokerUrl.value = url;
    persist();
    connectionStatus.value = '正在连接云端…';
    electronAPI.connectBroker({
      url,
      sensorTopic: up.topic,
      commandTopic: down.topic,
    });
    return { ok: true };
  };

  const disconnect = () => electronAPI.disconnectBroker?.();
  const sendCommand = (cmd) => electronAPI.sendCommand?.(cmd);

  const wireEvents = ({
    onConnected,
    onMessage,
    onReconnecting,
    onClosed,
    onError,
  } = {}) => {
    const offs = [];
    const track = (ret) => {
      if (typeof ret === 'function') offs.push(ret);
    };
    // preload bindChannel 会返回 unsubscribe；卸载时成对清理，避免热重载叠监听
    track(electronAPI.onConnected?.((payload) => {
      connectionStatus.value = '已连接';
      // 兼容旧版字符串 URL，以及新版 { url, sensorTopic, commandTopic }
      if (payload && typeof payload === 'object') {
        if (payload.url) brokerUrl.value = payload.url;
        if (payload.sensorTopic) sensorTopic.value = payload.sensorTopic;
        if (payload.commandTopic) commandTopic.value = payload.commandTopic;
        persist();
        onConnected?.(payload.url || payload);
      } else if (payload) {
        brokerUrl.value = payload;
        onConnected?.(payload);
      } else {
        onConnected?.(payload);
      }
    }));
    track(electronAPI.onMessage?.((payload) => onMessage?.(payload)));
    track(electronAPI.onReconnecting?.(() => {
      connectionStatus.value = '重连中...';
      onReconnecting?.();
    }));
    track(electronAPI.onClosed?.(() => {
      connectionStatus.value = '已断开';
      onClosed?.();
    }));
    track(electronAPI.onError?.((err) => {
      connectionStatus.value = '连接出错';
      onError?.(err);
    }));
    return () => {
      while (offs.length) {
        try { offs.pop()(); } catch (_) {}
      }
    };
  };

  return {
    connectionStatus,
    brokerUrl,
    sensorTopic,
    commandTopic,
    isConnected,
    isBusy,
    connect,
    disconnect,
    sendCommand,
    wireEvents,
    persist,
    validateTopicClient,
    DEFAULT_BROKER,
    DEFAULT_SENSOR_TOPIC: MQTT_TOPICS.sensor,
    DEFAULT_COMMAND_TOPIC: MQTT_TOPICS.command,
  };
}
