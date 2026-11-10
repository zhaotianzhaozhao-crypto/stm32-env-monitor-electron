<template>
  <div class="dashboard">
    <header class="title-bar">
      <div class="title-left">
        <div class="title-status-group">
          <button
            type="button"
            class="title-status clickable"
            :class="cloudStatusClass"
            :title="cloudStatusHint + '（点击重连 / 打开设置）'"
            @click="onCloudStatusClick"
          >
            <i class="title-status-dot" />
            {{ cloudStatusLabel }}
          </button>
          <span class="title-divider" />
          <button
            type="button"
            class="title-status device clickable"
            :class="deviceStatusClass"
            :title="deviceStatusHint + '（点击查看）'"
            @click="onDeviceStatusClick"
          >
            <i class="title-status-dot" />
            {{ deviceStatusLabel }}
          </button>
        </div>
      </div>
      <div class="title-drag-region" aria-hidden="true" />
      <div class="title-right">
        <span class="title-user" title="本地运行">本地</span>
        <button type="button" class="win-btn min" title="最小化" @click="minimizeApp">─</button>
        <button type="button" class="win-btn close" title="关闭" @click="closeApp">✕</button>
      </div>
    </header>

    <div class="main-body">
      <aside class="sidebar" @wheel.stop>
        <div class="segmented" role="tablist" aria-label="功能面板切换">
          <div class="seg-slider" :style="{ transform: `translateX(${activePanel * 100}%)` }" />
          <button
            v-for="(t, i) in PANEL_TABS"
            :key="t"
            type="button"
            class="seg-tab"
            :class="{ active: activePanel === i }"
            @click="activePanel = i"
          >{{ t }}</button>
        </div>

        <MqttPanel
          v-show="activePanel === 0"
          :connection-status="connectionStatus"
          :broker-url="brokerUrl"
          :sensor-topic="sensorTopic"
          :command-topic="commandTopic"
          :is-connected="isConnected"
          :is-busy="isBusy"
          :packet-count="packetCount"
          :last-rx-text="lastRxText"
          :data-online="dataOnline"
          :device-status-label="deviceStatusLabel"
          :device-status-class="deviceStatusClass"
          :device-status-hint="deviceStatusHint"
          :can-edit-broker="!!appConfig.canEditBroker"
          :demo-notice="appConfig.demoNotice || ''"
          :user-label="'本地'"
          :allowed-commands="liveAllowedCommands"
          :soft-config-open="softConfigOpen"
          :about-open="aboutOpen"
          @connect="onConnect"
          @disconnect="disconnect"
          @update:broker-url="onBrokerUrlUpdate"
          @update:sensor-topic="onSensorTopicUpdate"
          @update:command-topic="onCommandTopicUpdate"
          @open-soft-config="onOpenSoftConfig"
          @close-soft-config="softConfigOpen = false"
          @open-about="onOpenAbout"
          @close-about="aboutOpen = false"
        />

        <EnvMonitorPanel
          v-show="activePanel === 1"
          :temp="temp"
          :humidity="humidity"
          :aqi="aqi"
          :alarm-active="alarmActive"
          :temp-min="tempMin"
          :temp-max="tempMax"
          :hum-min="humMin"
          :hum-max="humMax"
          :aqi-max="aqiMax"
          :temp-alert-level="tempAlertLevel"
          :hum-alert-level="humAlertLevel"
          :aqi-alert-level="aqiAlertLevel"
          :has-hardware-data="hasHardwareData"
          :data-online="dataOnline"
          :is-connected="isConnected"
          :work-zones="workZones"
          :devices="userDevices"
          :tx-options="txOptions"
          :rx-options="rxOptions"
          :channel-values="channelValues"
          :can-export="historyCount > 0"
          :history-count="historyCount"
          :export-busy="exportBusy"
          :screen-skin="activeSkin"
          @open-chart="openSensorChart"
          @update-threshold="onUpdateThreshold"
          @go-connect="onGoConnect"
          @export-history="onExportHistory"
          @add-card="onAddCollectCard"
        />

        <DeviceControlPanel
          v-show="activePanel === 2"
          :is-connected="isConnected"
          :devices="userDevices"
          :tx-options="txOptions"
          :hw-actuators="hwActuators"
          :alarm-active="alarmActive"
          @send-command="onSendDeviceCommand"
        />

        <SkinPanel
          v-show="activePanel === 3"
          v-model="activeSkin"
          :skins="appConfig.skins || SKINS"
        />
      </aside>

      <div class="viewport" ref="canvasContainer">
        <div v-if="currentScene.caption" class="scene-caption">{{ currentScene.caption }}</div>
        <EnvHud
          v-show="activePanel !== 1 && !softConfigOpen && !aboutOpen"
          :temp="temp"
          :humidity="humidity"
          :aqi="aqi"
          :temp-alert-level="tempAlertLevel"
          :hum-alert-level="humAlertLevel"
          :aqi-alert-level="aqiAlertLevel"
          :data-online="dataOnline"
        />
        <nav v-show="!softConfigOpen && !aboutOpen" class="viewport-dock" aria-label="视窗工具">
          <button type="button" class="dock-btn" title="复位视角（拆解中会一并组装）" @click="reset3DView">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 11l8-7 8 7" />
              <path d="M6 10.5V19a1 1 0 001 1h3.5v-5h3v5H17a1 1 0 001-1v-8.5" />
            </svg>
            <span class="dock-label">视角</span>
          </button>
          <button
            type="button"
            class="dock-btn"
            :class="{ active: isExploded }"
            :title="isExploded ? '组装还原' : '拆解透视内部结构'"
            @click="toggle3DExplode"
          >
            <svg v-if="!isExploded" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
            </svg>
            <span class="dock-label">{{ isExploded ? '组装' : '拆解' }}</span>
          </button>
          <button
            type="button"
            class="dock-btn"
            :class="{ active: showLogs }"
            :title="showLogs ? '关闭日志' : '打开终端日志'"
            @click="showLogs = !showLogs"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h10" />
            </svg>
            <span class="dock-label">日志</span>
          </button>
        </nav>

        <div v-if="isExploded" class="explode-tip" role="status">
          拆解透视中 · 再点「组装」或「视角」可还原
        </div>

        <nav v-show="!softConfigOpen && !aboutOpen" class="scene-switcher" aria-label="场景切换">
          <button
            v-for="(sc, i) in SCENES"
            :key="sc.id || i"
            type="button"
            class="scene-pill"
            :class="{ active: sceneIndex === i }"
            :title="sc.name"
            @click="goScene(i)"
          >
            <span class="scene-pill-dot" aria-hidden="true" />
            <span class="scene-pill-label">{{ sc.name }}</span>
          </button>
        </nav>

        <SoftConfigPanel
          v-if="softConfigOpen"
          :rx-commands="rxCommands"
          :tx-commands="txCommands"
          :hint="softConfigHint"
          @close="softConfigOpen = false"
          @save-rx="onSaveRxCommands"
          @save-tx="onSaveTxCommands"
          @reset-rx="onResetRxCommands"
          @reset-tx="onResetTxCommands"
        />

        <AboutOverlay
          v-if="aboutOpen"
          :app-mode="appConfig.mode || 'demo'"
          @close="aboutOpen = false"
        />
      </div>
    </div>

    <ChartModal
      v-if="chartType"
      :zone-name="chartZoneName"
      :type="chartType"
      :color="chartColor"
      :history="chartHistory"
      :range-mode="chartRangeMode"
      :step="chartStep"
      :devices="userDevices"
      :rx-options="rxOptions"
      :tx-options="txOptions"
      :unit="chartUnit"
      :channel="chartChannel"
      :live-value="chartLiveValue"
      :is-connected="isConnected"
      :device-on="chartDeviceOn"
      v-model:min="chartMin"
      v-model:max="chartMax"
      v-model:device-id="chartDeviceId"
      @update:zone-name="onChartZoneName"
      @update:unit="onChartUnit"
      @update:channel="onChartChannel"
      @add-device="onAddDevice"
      @toggle-device="onChartToggleDevice"
      @close="closeChartModal"
    />

    <LogPanel v-if="showLogs" :logs="logs" :alarm-history="alarmHistory" @close="showLogs = false" @clear="clearLogs" />

    <ToastHost :toasts="toasts" />
    <ProgressOverlay
      :visible="progressVisible"
      :text="progressText"
      :percent="progressPercent"
      :blocking="progressBlocking"
    />
  </div>
</template>

<script setup>
/**
 * App.vue — 根编排：启动即仪表盘（侧栏 + 3D 视口 + 图表/日志）
 *
 * 【依赖】ThreeEngine、useMqtt/useSensorData/useAlarm/useHistory/useDeviceHealth、
 *   config.js（白名单/场景/皮肤）、electronAPI（主进程 MQTT/窗控）。
 * 【关键流】
 *   1) onMounted → bootstrapRuntime（无登录 / 无开机翻卡）
 *   2) MQTT 消息 → handleData → checkThresholds；屏点击 → publishScreenCommand（白名单校验）
 *   3) activeSkin watch → applyScreenSkin（孪生 + 可选 skin:* MQTT）
 * 【交互】标题栏云端状态可点重连/打开设置；环境监测与设备控制分 Tab；非环境监测时模型区左上 EnvHud；Toast + 进度条。
 * 【改时注意】屏控 breath:bri/color 故意不入白名单（HC-05 前仅本地）；勿误加进 allowedCommands 当硬控。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { initThreeEngine } from './three/ThreeEngine.js';
import { PANEL_TABS, SCENES, SKINS, ALLOWED_COMMANDS, DATA_TIMEOUT_MS } from './config.js';
import { useLogs } from './composables/useLogs.js';
import { useMqtt } from './composables/useMqtt.js';
import { useSoftConfig } from './composables/useSoftConfig.js';
import { useSensorData } from './composables/useSensorData.js';
import { useAlarm } from './composables/useAlarm.js';
import { useHistory } from './composables/useHistory.js';
import { exportSensorHistoryExcel } from './utils/exportSensorExcel.js';
import { useDeviceHealth } from './composables/useDeviceHealth.js';
import { useDevices } from './composables/useDevices.js';
import { useWorkZones } from './composables/useWorkZones.js';
import { useToast } from './composables/useToast.js';
import { useAutoControl } from './composables/useAutoControl.js';
import MqttPanel from './components/MqttPanel.vue';
import SoftConfigPanel from './components/SoftConfigPanel.vue';
import AboutOverlay from './components/AboutOverlay.vue';
import EnvMonitorPanel from './components/EnvMonitorPanel.vue';
import DeviceControlPanel from './components/DeviceControlPanel.vue';
import EnvHud from './components/EnvHud.vue';
import SkinPanel from './components/SkinPanel.vue';
import LogPanel from './components/LogPanel.vue';
import ChartModal from './components/ChartModal.vue';
import ToastHost from './components/ToastHost.vue';
import ProgressOverlay from './components/ProgressOverlay.vue';

/* ---- 皮肤 / 场景（无登录门闩） ---- */
const SKIN_KEY = 'naijiaren.skin';
/* 「我家」已移除：清掉旧平面缓存，避免占 localStorage */
try { localStorage.removeItem('naijiaren.homePlan'); } catch (_) {}
const SCREEN_SKIN_KEY = 'naijiaren.screenSkin';
const VALID_SKIN_IDS = new Set((SKINS || []).map((s) => s.id));

function readStoredScreenSkin() {
  try {
    const a = localStorage.getItem(SCREEN_SKIN_KEY);
    const b = localStorage.getItem(SKIN_KEY);
    const v = a || b || 'industrial-dark';
    return VALID_SKIN_IDS.has(v) ? v : 'industrial-dark';
  } catch (_) {
    return 'industrial-dark';
  }
}

const canvasContainer = ref(null);
const engine = ref(null);
const isExploded = ref(false);
const showLogs = ref(false);
const activePanel = ref(1);
const { toasts, success: toastOk, error: toastBad, info: toastInfo } = useToast();
/** 同一次连接失败只 Toast/记日志一次 */
let lastConnectError = '';
/** 云端状态 Toast：同状态只提示一次（避免重连回调刷屏） */
let lastCloudToastKey = '';
const toastCloudOnce = (key, fn, msg) => {
  if (lastCloudToastKey === key) return;
  lastCloudToastKey = key;
  fn(msg);
};

const progressVisible = ref(false);
const progressText = ref('');
const progressPercent = ref(-1);
const progressBlocking = ref(false);
let progressTimer = null;
const showProgress = (text, { percent = -1, blocking = false, autoHideMs = 0 } = {}) => {
  if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
  progressText.value = text || '处理中…';
  progressPercent.value = percent;
  progressBlocking.value = !!blocking;
  progressVisible.value = true;
  if (autoHideMs > 0) {
    progressTimer = setTimeout(() => { progressVisible.value = false; progressTimer = null; }, autoHideMs);
  }
};
const hideProgress = () => {
  if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
  progressVisible.value = false;
  progressBlocking.value = false;
};
const appConfig = ref({
  mode: 'demo',
  canEditBroker: true,
  demoNotice: '',
  skins: SKINS,
  allowedCommands: null,
  topics: null,
});
const activeSkin = ref(readStoredScreenSkin());

const sceneIndex = ref(0);
const currentScene = computed(() => SCENES[sceneIndex.value] || SCENES[0]);

const goScene = async (i) => {
  const target = ((i % SCENES.length) + SCENES.length) % SCENES.length;
  if (target === sceneIndex.value) return;
  sceneIndex.value = target;
  const scene = SCENES[sceneIndex.value];
  addLog(`【场景】切换到：${scene.name}（${scene.kind || 'glb'} · ${scene.file}）`);
  try {
    await engine.value?.loadModel?.(scene.file);
    if (scene.kind === 'schematic') isExploded.value = false;
  } catch (e) {
    addLog(`【场景】模型加载失败: ${e?.message || e}`);
  }
};

/* ---- MQTT / 传感器 / 报警 / 健康度 ---- */
const { logs, addLog, clearLogs } = useLogs();
const {
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
} = useMqtt();

const softConfigOpen = ref(false);
const aboutOpen = ref(false);
watch(activePanel, (v) => {
  if (v !== 0) {
    softConfigOpen.value = false;
    aboutOpen.value = false;
  }
});
const onOpenSoftConfig = () => {
  aboutOpen.value = false;
  softConfigOpen.value = true;
};
const onOpenAbout = () => {
  softConfigOpen.value = false;
  aboutOpen.value = true;
};
const {
  rxCommands,
  txCommands,
  rxOptions,
  txOptions,
  allowedFromTx,
  saveHint: softConfigHintRef,
  saveRx,
  saveTx,
  resetRxDefaults,
  resetTxDefaults,
  hasTx,
  resolveChannelKey,
  getTxCommandPair,
  getTxCommandsForAlarm,
  getTxName,
  bootstrapWhitelist,
} = useSoftConfig({ addLog: (...a) => addLog?.(...a) });
const softConfigHint = softConfigHintRef;
const liveAllowedCommands = computed(() => {
  const fromTx = allowedFromTx.value || [];
  if (fromTx.length) return fromTx;
  return appConfig.value?.allowedCommands || ALLOWED_COMMANDS;
});

const onSaveRxCommands = (rows) => {
  saveRx(rows);
};
const onSaveTxCommands = async (rows) => {
  if (!saveTx(rows)) return;
  appConfig.value = {
    ...appConfig.value,
    allowedCommands: allowedFromTx.value.slice(),
  };
};
const onResetRxCommands = () => resetRxDefaults();
const onResetTxCommands = () => {
  resetTxDefaults();
  appConfig.value = {
    ...appConfig.value,
    allowedCommands: allowedFromTx.value.slice(),
  };
};

const applyScreenSkin = (id, { pushMqtt = true } = {}) => {
  const skinId = VALID_SKIN_IDS.has(id) ? id : 'industrial-dark';
  if (activeSkin.value !== skinId) activeSkin.value = skinId;
  try {
    localStorage.setItem(SCREEN_SKIN_KEY, skinId);
    localStorage.setItem(SKIN_KEY, skinId);
  } catch (_) {}
  // 孪生屏换色板并立即重绘（与 SkinPanel 迷你屏同源 SCREEN_SKINS）
  const applied = engine.value?.setScreenSkin?.(skinId) || skinId;
  // 再用当前传感值刷一帧，避免仍停在占位 '--'
  try {
    const t = temp?.value;
    const h = humidity?.value;
    const a = aqi?.value;
    if (t !== undefined && engine.value?.updateScreenTexture) {
      engine.value.updateScreenTexture(t, h, a);
    }
  } catch (_) {}
  addLog(`【屏显皮肤】孪生预览 → ${applied}`);
  if (!pushMqtt) return;
  const cmd = `skin:${skinId}`;
  if (!(liveAllowedCommands.value || []).includes(cmd)) {
    addLog(`【屏显皮肤】指令未在白名单：${cmd}`);
    return;
  }
  if (!isConnected.value) {
    addLog(`【屏显皮肤】MQTT 未连接，仅本地预览（固件需支持 ${cmd}）`);
    return;
  }
  try {
    showProgress(`下发皮肤… ${cmd}`, { percent: 50, blocking: false, autoHideMs: 900 });
    sendCommand(cmd);
    addLog(`【屏幕皮肤】已下发 ${cmd}`);
    toastOk(`已下发 ${cmd}`);
  } catch (e) {
    addLog(`【屏显皮肤】下发失败: ${e?.message || e}`);
    toastBad(`下发失败：${e?.message || e}`);
    hideProgress();
  }
};

watch(activeSkin, (v) => {
  applyScreenSkin(v, { pushMqtt: true });
});

const { pushSample, getHistory, getExportRows, getAllSeries, times: historyTimes } = useHistory();
const historyCount = computed(() => historyTimes.value.length);
const exportBusy = ref(false);
const {
  temp,
  humidity,
  aqi,
  btnState,
  lastRxAt,
  packetCount,
  hwActuators,
  channelValues,
  handleData,
  noteParseError,
  reset: resetSensor,
} = useSensorData(engine, addLog, pushSample, () => rxCommands.value);
/* ---- 用户设备 + 工作区间（趋势弹窗） ---- */
const {
  devices: userDevices,
  addDevice,
  renameDevice,
  removeDevice,
  setDeviceCommands,
  getName: getDeviceName,
  getCommands: getDeviceCommands,
  has: hasDevice,
  getDefaultDeviceId,
  findIdByType,
} = useDevices();

const {
  zones: workZones,
  getZone,
  updateZone,
  addZone,
  removeZone,
  rebindDevice: rebindZoneDevice,
} = useWorkZones({
  has: hasDevice,
  hasTx,
  getDefaultDeviceId,
  findIdByType,
});
void removeZone;

const {
  tempMin,
  tempMax,
  tempTarget,
  humMin,
  humMax,
  humTarget,
  aqiMax,
  aqiTarget,
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
  reset: resetAlarm,
} = useAlarm({
  temp,
  humidity,
  aqi,
  isConnected,
  sendCommand,
  addLog,
  getDeviceName: (id) => getTxName(id) || getDeviceName(id),
  getDefaultDeviceId: () => (txOptions.value[0]?.id || getDefaultDeviceId()),
  getDeviceCommands: (id) => {
    const fromTx = getTxCommandsForAlarm(id);
    if (fromTx && fromTx.length) return fromTx;
    return getDeviceCommands(id);
  },
});

const tempAlertLevel = computed(() => tempLevel());
const humAlertLevel = computed(() => humLevel());
const aqiAlertLevel = computed(() => aqiLevel());

/* ---- 智能家居中控：手动/自动 + 场景 + 自动风扇 ---- */
const {
  controlMode,
  sceneBusy,
  setControlMode,
  checkAutoFan,
  runScene,
} = useAutoControl({
  isConnected,
  sendCommand,
  addLog,
  toastOk,
  toastBad,
  forceMode,
  getDevices: () => userDevices.value || [],
});

const onRunScene = (sceneId) => {
  runScene(sceneId);
};

const onUpdateThreshold = ({ type, bound, value }) => {
  if (type === 'temp' && bound === 'min') setTempMin(value);
  else if (type === 'temp' && bound === 'max') setTempMax(value);
  else if (type === 'temp' && bound === 'target') setTempTarget(value);
  else if (type === 'humidity' && bound === 'min') setHumMin(value);
  else if (type === 'humidity' && bound === 'max') setHumMax(value);
  else if (type === 'humidity' && bound === 'target') setHumTarget(value);
  else if (type === 'aqi' && bound === 'max') setAqiMax(value);
  else if (type === 'aqi' && bound === 'target') setAqiTarget(value);
};

const {
  dataOnline,
  hasHardwareData,
  lastRxText,
  deviceStatusLabel,
  deviceStatusClass,
  deviceStatusHint,
  cloudStatusLabel,
  cloudStatusClass,
  cloudStatusHint,
  startHealthTimer,
  stopHealthTimer,
} = useDeviceHealth({
  isConnected,
  connectionStatus,
  isBusy,
  lastRxAt,
  temp,
});

/** 同步 WiFi；F411 硬件页无 breath/fan，不在此强推开关。蜂鸣仅保留状态字段。 */
const syncScreenExtras = () => {
  const wifiLevel = isConnected.value ? 4 : (isBusy.value ? 2 : 0);
  const hw = hwActuators.value || {};
  const fresh = !!hw.at && (Date.now() - hw.at) < (DATA_TIMEOUT_MS || 8000);
  const partial = { wifiLevel };
  // 若上行显式带了 wifi，useSensorData 已写入；此处仅在无上行时回退连接态
  if (fresh && hw.buzzerOn !== null && hw.buzzerOn !== undefined) {
    partial.buzzerOn = !!hw.buzzerOn;
  } else {
    partial.buzzerOn = !!alarmActive.value;
  }
  engine.value?.setScreenState?.(partial);
};
watch([isConnected, isBusy, alarmActive], syncScreenExtras);
watch(engine, (e) => { if (e) { applyScreenSkin(activeSkin.value, { pushMqtt: false }); syncScreenExtras(); } });

/** 屏点击 / 外壳「灯光」键 → 本地已动画；此处下发 MQTT（固件未实现则仅孪生预览） */
const publishScreenCommand = (ctrl, state, extra) => {
  // 灯光二级菜单：亮度 / 颜色（本地预览；可选 breath MQTT 占位，HC-05 前不下发硬控）
  if (ctrl === 'breath' && state === 'menu') {
    addLog('【屏控】灯光二级菜单（亮度/颜色）');
    return;
  }
  if (ctrl === 'breath' && state === 'bri') {
    const n = Math.round(Math.max(0, Math.min(100, Number(extra) || 0)));
    // 占位协议 breath:bri:N — HC-05 前不入白名单，仅本地孪生 + 日志
    addLog(`【屏控】灯亮度 ${n}%（本地孪生；占位 breath:bri:${n}，待 HC-05）`);
    return;
  }
  if (ctrl === 'breath' && state === 'color') {
    const hex = String(extra || '').replace(/^#/, '').toUpperCase();
    addLog(`【屏控】灯颜色 #${hex}（本地孪生；占位 breath:color:${hex}，待 HC-05）`);
    return;
  }

  const on = state === 'on';
  if (ctrl === 'buzzer') {
    if (on) forceOn();
    else forceOff();
    addLog(`【屏控】蜂鸣 → ${on ? '开启' : '关闭'}（buzzer:${state}）`);
    return;
  }
  // breath = 屏上灯开关；真灯控规划走 HC-05，MQTT breath:* 为占位协议
  // fan:* 为风扇占位协议，固件未接 GPIO 前仅孪生预览
  const cmd = `${ctrl}:${state}`;
  if (!(liveAllowedCommands.value || []).includes(cmd)) {
    addLog(`【屏控】指令未在白名单：${cmd}（仅本地动画）`);
    return;
  }
  if (!isConnected.value) {
    addLog(`【屏控】MQTT 未连接，仅本地动画 · ${cmd}`);
    return;
  }
  try {
    showProgress(`下发中… ${cmd}`, { percent: 55, blocking: false, autoHideMs: 900 });
    sendCommand(cmd);
    const note = ctrl === 'breath'
      ? '（灯控最终走 HC-05；当前 MQTT breath:* 为占位，固件未实现则无效）'
      : '（风扇固件未接则无效）';
    addLog(`【屏控】已下发 ${cmd} ${note}`);
    toastOk(`已下发 ${cmd}`);
  } catch (e) {
    addLog(`【屏控】下发失败: ${e?.message || e}`);
    toastBad(`下发失败：${e?.message || e}`);
    hideProgress();
  }
};

let bootRafId = 0;
let unwireMqtt = null;
let wasDataOnline = false;
let wired = false;

const minimizeApp = () => window.electronAPI?.minimize?.();
const closeApp = () => window.electronAPI?.close?.();

/* ---- 图表弹窗 / 视窗工具 ---- */
const chartType = ref(null);
const chartHistory = ref({ times: [], data: [] });

const chartZone = computed(() => (chartType.value ? getZone(chartType.value) : null));
const chartZoneName = computed(() => chartZone.value?.name || '');
const chartColor = computed(() => chartZone.value?.color || '#007AFF');
const chartUnit = computed(() => chartZone.value?.unit ?? '');
const chartRangeMode = computed(() => chartZone.value?.rangeMode || 'minmax');
const chartStep = computed(() => chartZone.value?.step ?? 1);

const chartChannel = computed(() => chartZone.value?.channel || chartType.value || 'temp');

/** 趋势弹窗传感器芯片：当前通道实时值 */
const chartLiveValue = computed(() => {
  const ch = chartChannel.value;
  const key = resolveChannelKey(ch) || ch || '';
  const cv = channelValues.value || {};
  if (key && cv[key] !== undefined && cv[key] !== null && cv[key] !== '') return cv[key];
  if (key === 'temp' || key === 'temperature' || key === 't') return temp.value;
  if (key === 'humidity' || key === 'hum' || key === 'rh') return humidity.value;
  if (key === 'aqi' || key === 'air' || key === 'mq2') return aqi.value;
  if (chartType.value === 'temp') return temp.value;
  if (chartType.value === 'humidity') return humidity.value;
  if (chartType.value === 'aqi') return aqi.value;
  return '--';
});

/** 绑定执行器开/关：优先硬件上报，其次报警态（蜂鸣类） */
const chartDeviceOn = computed(() => {
  const id = chartDeviceId.value;
  const pair = id ? getTxCommandPair(id) : null;
  const fmt = String(pair?.format || pair?.on || '').toLowerCase();
  const hw = hwActuators.value || {};
  if (fmt.startsWith('buzzer') || fmt.includes('buzzer')) {
    if (hw.buzzerOn !== null && hw.buzzerOn !== undefined) return !!hw.buzzerOn;
    return !!alarmActive.value;
  }
  if (fmt.startsWith('fan')) {
    if (hw.fanOn !== null && hw.fanOn !== undefined) return !!hw.fanOn;
    return false;
  }
  if (fmt.startsWith('breath') || fmt.startsWith('light')) {
    if (hw.breathOn !== null && hw.breathOn !== undefined) return !!hw.breathOn;
    return false;
  }
  // 非 TX：按设备类型估
  const d = (userDevices.value || []).find((x) => x.id === id);
  if (d?.type === 'buzzer') return hw.buzzerOn != null ? !!hw.buzzerOn : !!alarmActive.value;
  if (d?.type === 'fan') return !!hw.fanOn;
  if (d?.type === 'light') return !!hw.breathOn;
  return !!alarmActive.value;
});

const onChartToggleDevice = ({ deviceId, on, blocked } = {}) => {
  const id = String(deviceId || chartDeviceId.value || '').trim();
  if (!id) {
    toastInfo('请先在⚙里绑定执行设备');
    return;
  }
  if (blocked === 'offline' || !isConnected.value) {
    toastBad('MQTT 未连接，无法下发');
    addLog('【采集卡】切换执行器失败：MQTT 未连接');
    return;
  }
  const pair = getTxCommandPair(id);
  let cmd = '';
  if (pair) {
    cmd = on ? (pair.on || pair.format) : (pair.off || pair.format);
  } else {
    const list = getDeviceCommands(id) || [];
    if (on) cmd = list.find((c) => String(c).endsWith(':on')) || list[0] || 'buzzer:on';
    else cmd = list.find((c) => String(c).endsWith(':off')) || 'buzzer:off';
  }
  cmd = String(cmd || '').trim();
  if (!cmd) {
    toastBad('该绑定没有可下发的开/关指令');
    return;
  }
  // 蜂鸣：走报警手动开/关，保持状态机一致
  if (/^buzzer:/i.test(cmd)) {
    if (on) forceOn();
    else forceOff();
    addLog(`【采集卡】蜂鸣 → ${on ? '开' : '关'}（${cmd}）`);
    toastOk(`蜂鸣已${on ? '开' : '关'}`);
    return;
  }
  onSendDeviceCommand({ name: getTxName(id) || getDeviceName(id) || id, cmd });
};

const chartMin = computed({
  get() {
    if (chartType.value === 'temp') return tempMin.value;
    if (chartType.value === 'humidity') return humMin.value;
    const z = chartType.value ? getZone(chartType.value) : null;
    return z && Number.isFinite(Number(z.min)) ? Number(z.min) : undefined;
  },
  set(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    if (chartType.value === 'temp') setTempMin(n);
    else if (chartType.value === 'humidity') setHumMin(n);
    else if (chartType.value) updateZone(chartType.value, { min: n });
  },
});

const chartMax = computed({
  get() {
    if (chartType.value === 'temp') return tempMax.value;
    if (chartType.value === 'humidity') return humMax.value;
    if (chartType.value === 'aqi') return aqiMax.value;
    const z = chartType.value ? getZone(chartType.value) : null;
    return z && Number.isFinite(Number(z.max)) ? Number(z.max) : 0;
  },
  set(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    if (chartType.value === 'aqi' && n <= 0) return;
    if (chartType.value === 'temp') setTempMax(n);
    else if (chartType.value === 'humidity') setHumMax(n);
    else if (chartType.value === 'aqi') setAqiMax(n);
    else if (chartType.value) updateZone(chartType.value, { max: n });
  },
});

/** 弹窗「绑定执行设备」：与报警阈值 deviceId / 工作区间 deviceId 同步（不改卡片名） */
const chartDeviceId = computed({
  get() {
    if (chartType.value === 'temp') return tempTarget.value;
    if (chartType.value === 'humidity') return humTarget.value;
    if (chartType.value === 'aqi') return aqiTarget.value;
    const z = chartType.value ? getZone(chartType.value) : null;
    return z?.deviceId || txOptions.value[0]?.id || getDefaultDeviceId();
  },
  set(v) {
    if (chartType.value === 'temp') setTempTarget(v);
    else if (chartType.value === 'humidity') setHumTarget(v);
    else if (chartType.value === 'aqi') setAqiTarget(v);
    if (chartType.value) updateZone(chartType.value, { deviceId: v });
  },
});

const onChartZoneName = (name) => {
  if (!chartType.value) return;
  updateZone(chartType.value, { name });
};

const onChartUnit = (unit) => {
  if (!chartType.value) return;
  updateZone(chartType.value, { unit });
};

const onChartChannel = (ch) => {
  if (!chartType.value) return;
  const id = String(ch || '').trim();
  if (!id) return;
  updateZone(chartType.value, { channel: id });
  const histKey = resolveChannelKey(id) || id;
  chartHistory.value = getHistory(histKey);
};

/** 设置页添加：须自定名称 { name, type? }；名称为空则拒绝 */
const onAddDevice = (payload) => {
  const d = addDevice(payload);
  if (!d) {
    addLog('【设备】添加失败：名称不能为空');
    return;
  }
  if (chartType.value) {
    chartDeviceId.value = d.id;
  }
  addLog(`【设备】已添加「${d.name}」（${d.type || 'custom'}）`);
};

const onRenameDevice = ({ id, name }) => {
  if (renameDevice(id, name)) addLog(`【设备】已重命名为「${name}」`);
};

const onRemoveDevice = (id) => {
  const { removed, fallbackId, reason } = removeDevice(id);
  if (!removed) {
    if (reason === 'builtin') addLog('【设备】默认设备不可删除');
    else if (reason === 'last') addLog('【设备】至少保留一台，未删除');
    else addLog('【设备】未删除');
    return;
  }
  rebindZoneDevice(id, fallbackId);
  rebindAlarmDevice(id, fallbackId);
  if (chartType.value) chartDeviceId.value = fallbackId;
  addLog('【设备】已删除并改绑工作区间');
};

/** 设置页 · 整表覆盖某设备白名单指令 */
const onSetDeviceCommands = ({ id, commands }) => {
  if (setDeviceCommands(id, commands)) {
    addLog(`【设备指令】已更新「${getDeviceName(id)}」共 ${(commands || []).length} 条`);
  }
};

/** 经现有 MQTT 通道下发（主进程白名单校验） */
const onSendDeviceCommand = ({ name, cmd, id } = {}) => {
  const s = String(cmd || '').trim();
  if (!s) return;
  if (!isConnected.value) {
    addLog(`【设备指令】MQTT 未连接，无法下发 ${s}`);
    toastBad('MQTT 未连接，无法下发');
    return;
  }
  // 蜂鸣统一走报警状态机，避免 UI 本地开关与 forceMode 脱节
  if (/^buzzer:(on|off)$/i.test(s)) {
    const on = /:on$/i.test(s);
    try {
      if (on) forceOn(id);
      else forceOff(id);
      addLog(`【设备指令】蜂鸣 → ${on ? '开' : '关'}（${s}${name ? ' · ' + name : ''}）`);
      toastOk(`蜂鸣已${on ? '开' : '关'}`);
    } catch (e) {
      addLog(`【设备指令】蜂鸣下发失败: ${e?.message || e}`);
      toastBad(`下发失败：${e?.message || e}`);
    }
    return;
  }
  try {
    showProgress(`下发中… ${s}`, { percent: 55, blocking: false, autoHideMs: 900 });
    sendCommand(s);
    addLog(`【设备指令】已下发「${name || ''}」→ ${s}`);
    toastOk(`已下发 ${name ? name + ' · ' : ''}${s}`);
  } catch (e) {
    addLog(`【设备指令】下发失败: ${e?.message || e}`);
    toastBad(`下发失败：${e?.message || e}`);
    hideProgress();
  }
};;

const onExportHistory = async () => {
  if (exportBusy.value) return;
  const rows = getExportRows();
  if (!rows.length) {
    toastInfo('暂无历史数据');
    addLog('【导出】暂无历史数据');
    return;
  }
  exportBusy.value = true;
  try {
    const { filename, rowCount } = await exportSensorHistoryExcel({
      rows,
      ...getAllSeries(),
    });
    toastOk(`已导出 ${rowCount} 条 → ${filename}`);
    addLog(`【导出】Excel ${rowCount} 点 → ${filename}`);
  } catch (e) {
    const msg = e?.code === 'EMPTY' ? '暂无历史数据' : (e?.message || String(e));
    toastBad(`导出失败：${msg}`);
    addLog(`【导出】失败: ${msg}`);
  } finally {
    exportBusy.value = false;
  }
};
/** 环境监测「添加采集卡」：新建 workZone，默认绑第一条接收指令，并打开配置弹窗 */
const onAddCollectCard = () => {
  const rx = rxOptions.value || [];
  const used = new Set(
    Object.values(workZones.value || {}).map((z) => String(z?.channel || '')),
  );
  const pick =
    rx.find((r) => r?.id && !used.has(r.id) && !used.has(r.key)) ||
    rx[0] ||
    null;
  const channel = pick ? (pick.id || pick.key) : 'temp';
  const nameBase = pick?.name ? `${pick.name}采集` : '新采集卡';
  const id = addZone({
    name: nameBase,
    channel,
    unit: '',
    deviceId: txOptions.value[0]?.id || getDefaultDeviceId(),
  });
  if (!id) {
    toastBad('添加采集卡失败');
    addLog('【采集卡】添加失败');
    return;
  }
  addLog(`【采集卡】已添加「${nameBase}」通道 ${channel}`);
  toastOk(`已添加采集卡 · ${nameBase}`);
  openSensorChart(id);
};

const openSensorChart = (type) => {
  chartType.value = type;
  const z = getZone(type);
  const channel = z?.channel || type;
  chartHistory.value = getHistory(resolveChannelKey(channel) || channel);
};
const closeChartModal = () => { chartType.value = null; };


/** MQTT 地址/Topic 变更提示（弹窗，替代原静态灰字） */
const MQTT_REAPPLY_HINT = '改 Broker 后需断开并重新「接入云端」才会生效';
let _mqttHintAt = 0;
const toastMqttReapplyHint = () => {
  const now = Date.now();
  if (now - _mqttHintAt < 1600) return;
  _mqttHintAt = now;
  toastInfo(MQTT_REAPPLY_HINT);
};
const onBrokerUrlUpdate = (v) => {
  brokerUrl.value = v;
  if (!isConnected.value) toastMqttReapplyHint();
};
const onSensorTopicUpdate = (v) => {
  sensorTopic.value = v;
  if (!isConnected.value) toastMqttReapplyHint();
};
const onCommandTopicUpdate = (v) => {
  commandTopic.value = v;
  if (!isConnected.value) toastMqttReapplyHint();
};

const onConnect = () => {
  lastConnectError = '';
  // 主动再连时允许重新提示「正在连接 / 已连接」
  if (['connected', 'closed', 'error', 'connected-hint'].includes(lastCloudToastKey)) {
    lastCloudToastKey = '';
  }
  const result = connect();
  if (result && result.ok === false) {
    addLog(`【云端】连接预检失败: ${result.reason || '参数无效'}`);
    toastBad(result.reason || 'MQTT 参数无效');
    return;
  }
  addLog(
    `【云端】正在连接 Broker: ${brokerUrl.value}｜上行 ${sensorTopic.value}｜下行 ${commandTopic.value}`,
  );
  showProgress('正在连接 MQTT…', { percent: 30, blocking: false });
  toastCloudOnce('connecting', toastInfo, '正在连接云端…');
};

/** 标题栏 · 云端状态点击：未连则重连并切到设置；已连则打开设置面板 */
const onCloudStatusClick = () => {
  activePanel.value = 0;
  if (isConnected.value) {
    toastCloudOnce('connected-hint', toastInfo, '云端已连接 · 可在设置中断开或改 Broker');
    return;
  }
  if (isBusy.value) {
    toastInfo('正在连接中…');
    return;
  }
  onConnect();
};

/** 标题栏 · 设备状态点击：给出简短提示 */
const onDeviceStatusClick = () => {
  toastInfo(deviceStatusHint.value || deviceStatusLabel.value || '设备状态');
};

/** 环境监测离线引导 → 切到设置并尝试连接 */
const onGoConnect = () => {
  activePanel.value = 0;
  if (!isConnected.value && !isBusy.value) onConnect();
  else toastInfo(isConnected.value ? '云端已连接，等待设备上报' : '正在连接…');
};

const toggle3DExplode = () => {
  if (!engine.value?.toggleExplode) return;
  isExploded.value = !isExploded.value;
  engine.value.toggleExplode(isExploded.value);
  addLog(isExploded.value ? '【系统】进入拆解透视（面板半透）' : '【系统】已组装还原');
};

const reset3DView = () => {
  if (!engine.value?.resetCamera) return;
  // 复位视角；若仍在拆解态则一并组装，避免「视角正了但机壳还是散的」
  const wasExploded = isExploded.value;
  if (wasExploded && engine.value.toggleExplode) {
    isExploded.value = false;
    engine.value.toggleExplode(false);
  }
  engine.value.resetCamera();
  addLog(wasExploded ? '【系统】视角已复位并组装' : '【系统】视角已复位');
};


/** 挂载 3D + 订阅 MQTT 事件；幂等（engine/wired 只初始化一次） */
const bootstrapRuntime = () => {
  if (!canvasContainer.value) return;
  if (!engine.value) {
    engine.value = initThreeEngine(canvasContainer.value, (clickedKeyName) => {
      const name = String(clickedKeyName || '');
      if (name.startsWith('screen:')) {
        const parts = name.split(':');
        const ctrl = parts[1];
        const action = parts[2];
        if (ctrl === 'breath' && (action === 'menu' || action === 'bri' || action === 'color')) {
          publishScreenCommand(ctrl, action, parts[3]);
          return;
        }
        const state = action === 'on' ? 'on' : 'off';
        publishScreenCommand(ctrl, state);
        return;
      }
      addLog(`【3D】点击外壳 UI 键（非 MCU SW）: ${name}`);
    });
  }
  if (!wired) {
    // 把本地下发指令表同步到主进程白名单
    try { bootstrapWhitelist(); } catch (_) {}
    unwireMqtt = wireEvents({
      onConnected: (url) => {
        lastConnectError = '';
        hideProgress();
        showProgress('云端已连接', { percent: 100, blocking: false, autoHideMs: 1600 });
        addLog(`【云端】已连接: ${url}｜上行 ${sensorTopic.value}｜下行 ${commandTopic.value}`);
        toastCloudOnce('connected', toastOk, '云端已连接');
      },
      onMessage: (raw) => {
        try {
          handleData(JSON.parse(raw));
          checkThresholds();
          checkAutoFan(temp.value, tempMax.value);
          if (chartType.value) {
            const z = getZone(chartType.value);
            chartHistory.value = getHistory(resolveChannelKey(z?.channel || chartType.value) || z?.channel || chartType.value);
          }
        } catch (e) {
          noteParseError(raw, e);
        }
      },
      onReconnecting: () => {
        showProgress('链路中断，自动重连…', { percent: 40, blocking: false });
        addLog('【云端】链路中断，自动重连…');
        toastCloudOnce('reconnecting', toastInfo, '正在重连…');
      },
      onClosed: () => {
        hideProgress();
        resetSensor();
        resetAlarm();
        wasDataOnline = false;
        addLog('【网络】链路已断开');
        toastCloudOnce('closed', toastInfo, '云端已断开');
      },
      onError: (err) => {
        hideProgress();
        const msg = String(err || '未知错误');
        if (msg === lastConnectError) return; // 同一次失败只报一次
        lastConnectError = msg;
        addLog(`【网络】连接出错: ${msg}`);
        toastCloudOnce(`error:${msg}`, toastBad, `连接出错：${msg}`);
      },
    });
    wired = true;
  }
  startHealthTimer(() => {
    const online = !!dataOnline.value;
    if (wasDataOnline && !online && isConnected.value) {
      addLog('【链路】硬件数据超时，判定为离线');
      silence('数据超时');
    }
    wasDataOnline = online;
  });
};

onMounted(async () => {
  try {
    // 清理历史登录会话残留（已取消登录）
    sessionStorage.removeItem('naijiaren.session');
  } catch (_) {}

  try {
    const cfg = await window.electronAPI?.getAppConfig?.();
    if (cfg) appConfig.value = { ...appConfig.value, ...cfg };
  } catch (_) {}
  try {
    bootstrapWhitelist();
    if (allowedFromTx.value?.length) {
      appConfig.value = {
        ...appConfig.value,
        allowedCommands: allowedFromTx.value.slice(),
      };
    }
  } catch (_) {}

  addLog('【系统】本地运行 · 已跳过登录与开机动画');
  // dashboard 已挂载，下一帧初始化 3D + MQTT 事件
  bootRafId = requestAnimationFrame(() => bootstrapRuntime());
});

onBeforeUnmount(() => {
  if (bootRafId) {
    cancelAnimationFrame(bootRafId);
    bootRafId = 0;
  }
  try { unwireMqtt?.(); } catch (_) {}
  unwireMqtt = null;
  hideProgress();
  stopHealthTimer();
  engine.value?.dispose();
  if (isConnected.value) disconnect();
});
</script>
