import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { DATA_TIMEOUT_MS } from '../config.js';

/**
 * 云端 / 设备双状态机（与 MQTT「是否连上 Broker」解耦）
 *
 * 【设备】cloud_off → waiting → online|offline；超时 DATA_TIMEOUT_MS（默认 8s）。
 * 【云端】只反映 Broker 链路；标题栏两颗状态灯分别绑 cloud* / device*。
 * 【定时】须调用 startHealthTimer（App bootstrap）每秒刷新 nowTick，否则 dataOnline 不更新。
 */
export function useDeviceHealth({
  isConnected,
  connectionStatus,
  isBusy,
  lastRxAt,
  temp,
  timeoutMs = DATA_TIMEOUT_MS,
} = {}) {
  const nowTick = ref(Date.now());
  let healthTimer = null;

  const dataOnline = computed(() => {
    if (!lastRxAt?.value) return false;
    return nowTick.value - lastRxAt.value < timeoutMs;
  });

  const hasHardwareData = computed(() => {
    const v = temp?.value;
    return v !== '--' && v !== null && v !== undefined;
  });

  const lastRxText = computed(() => {
    if (!lastRxAt?.value) return '暂无';
    const sec = Math.max(0, Math.floor((nowTick.value - lastRxAt.value) / 1000));
    if (sec <= 0) return '刚刚';
    if (sec < 60) return `${sec} 秒前`;
    return `${Math.floor(sec / 60)} 分前`;
  });

  /** cloud_off | waiting | online | offline */
  const deviceStatusKey = computed(() => {
    if (!isConnected?.value) return 'cloud_off';
    if (!lastRxAt?.value) return 'waiting';
    if (nowTick.value - lastRxAt.value < timeoutMs) return 'online';
    return 'offline';
  });

  const deviceStatusLabel = computed(
    () =>
      ({
        cloud_off: '设备 —',
        waiting: '等待设备',
        online: '设备在线',
        offline: '设备离线',
      })[deviceStatusKey.value]
  );

  const deviceStatusClass = computed(
    () =>
      ({
        cloud_off: 'dev-off',
        waiting: 'dev-wait',
        online: 'dev-on',
        offline: 'dev-bad',
      })[deviceStatusKey.value]
  );

  const deviceStatusHint = computed(
    () =>
      ({
        cloud_off: '请先连接云端 Broker，再等待硬件上报',
        waiting: '云端已通，等待硬件上报 temp / humidity / aqi / btn',
        online: `最近收包：${lastRxText.value}`,
        offline: `超过 ${timeoutMs / 1000}s 未收到数据，请检查 ESP/STM32`,
      })[deviceStatusKey.value]
  );

  const cloudStatusLabel = computed(() => {
    if (isConnected?.value) return '云端已连接';
    const s = connectionStatus?.value || '';
    if (s.includes('握手') || s.includes('连接云端') || s === '重连中...') return s;
    if (s === '连接出错') return '云端连接失败';
    if (s === '已断开') return '云端已断开';
    if (s.includes('Electron')) return s;
    return s || '云端未连接';
  });

  const cloudStatusClass = computed(() => {
    if (isConnected?.value) return 'on';
    if (isBusy?.value) return 'busy';
    if (connectionStatus?.value === '连接出错') return 'err';
    return 'off';
  });

  const cloudStatusHint = computed(() => {
    if (isConnected?.value) return '仅表示已连上 MQTT 云端，不代表设备在线';
    if (isBusy?.value) return '正在与 Broker 握手…';
    if (connectionStatus?.value === '连接出错') return '请检查 Broker 地址与网络';
    return '点击「接入云端」连接 MQTT Broker';
  });

  const startHealthTimer = (onTick) => {
    stopHealthTimer();
    healthTimer = setInterval(() => {
      nowTick.value = Date.now();
      onTick?.(nowTick.value);
    }, 1000);
  };

  const stopHealthTimer = () => {
    if (healthTimer) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
  };

  /** 在组件 setup 中调用：挂载启动、卸载清理 */
  const bindLifecycle = (onTick) => {
    onMounted(() => startHealthTimer(onTick));
    onBeforeUnmount(() => stopHealthTimer());
  };

  return {
    nowTick,
    dataOnline,
    hasHardwareData,
    lastRxText,
    deviceStatusKey,
    deviceStatusLabel,
    deviceStatusClass,
    deviceStatusHint,
    cloudStatusLabel,
    cloudStatusClass,
    cloudStatusHint,
    timeoutMs,
    startHealthTimer,
    stopHealthTimer,
    bindLifecycle,
  };
}
