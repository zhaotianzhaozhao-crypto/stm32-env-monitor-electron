<template>
  <SidebarPanel title="⚙️ 设置" stretch>
    <div class="settings-subnav" role="tablist" aria-label="设置子菜单">
      <button
        type="button"
        class="settings-subtab"
        :class="{ active: subTab === 'mqtt' }"
        @click="setSub('mqtt')"
      >MQTT 连接</button>
      <button
        type="button"
        class="settings-subtab"
        :class="{ active: subTab === 'soft' }"
        @click="setSub('soft')"
      >软件配置</button>
    </div>

    <section v-show="subTab === 'mqtt'" class="settings-section">
      <header class="settings-section-head">
        <h3 class="settings-section-title">MQTT 连接</h3>
      </header>

      <label class="broker-label">Broker 地址</label>
      <input
        class="broker-input"
        type="text"
        :value="brokerUrl"
        :disabled="!canEditBroker || isConnected || isBusy"
        :placeholder="canEditBroker ? 'mqtt://broker.emqx.io:1883' : '由配置锁定'"
        @input="$emit('update:brokerUrl', $event.target.value)"
      />
      <p v-if="!canEditBroker" class="broker-lock-hint">生产模式：Broker 由配置锁定，仅管理员可改（当前只读）</p>
      <p v-else-if="isConnected" class="broker-lock-hint">已连接时不可改地址，请先断开</p>

      <div class="btn-row">
        <button
          class="btn-success"
          :disabled="isConnected || isBusy"
          @click="$emit('connect')"
        >
          {{ isBusy ? '连接中…' : '接入云端' }}
        </button>
        <button
          class="btn-danger"
          :disabled="!isConnected && !isBusy"
          @click="$emit('disconnect')"
        >
          断开
        </button>
      </div>

      <div class="link-result">
        <div class="link-card">
          <div class="link-card-title">云端（MQTT）</div>
          <div class="link-card-value" :class="isConnected ? 'ok' : isBusy ? 'busy' : connectionStatus === '连接出错' ? 'bad' : ''">
            {{ isConnected ? '已连接' : connectionStatus }}
          </div>
          <p v-if="!isConnected && connectionStatus === '连接出错'" class="broker-lock-hint">连接出错：请检查 Broker 地址与 Topic，然后重试接入</p>
        </div>
        <div class="link-card">
          <div class="link-card-title">设备（硬件）</div>
          <div class="link-card-value" :class="deviceStatusClass">
            {{ deviceStatusLabel }}
          </div>
        </div>
      </div>

      <div class="mqtt-meta">
        <div class="mqtt-line">
          <span class="k">收包计数</span>
          <span class="v">{{ packetCount }}</span>
        </div>
        <div class="mqtt-line">
          <span class="k">最近收包</span>
          <span class="v">{{ lastRxText || '暂无' }}</span>
        </div>
        <div class="mqtt-line">
          <span class="k">运行身份</span>
          <span class="v">{{ userLabel || '本地' }}</span>
        </div>
      </div>
    </section>

    <div class="about-footer">
      <button
        type="button"
        class="about-link"
        :class="{ active: aboutOpen }"
        @click="openAbout"
      >关于</button>
    </div>
  </SidebarPanel>
</template>

<script setup>
/**
 * 设置 Tab：MQTT 连接 / 软件配置；底部蓝链「关于」打开右侧 AboutOverlay。
 * 生产 canEditBroker=false；真正校验在主进程 validateBrokerUrl / validateTopic。
 */
import { ref, watch } from 'vue';
import SidebarPanel from './SidebarPanel.vue';

const props = defineProps({
  /** 父级是否已打开右侧软件配置板 */
  softConfigOpen: { type: Boolean, default: false },
  /** 父级是否已打开关于覆盖层 */
  aboutOpen: { type: Boolean, default: false },
  connectionStatus: String,
  brokerUrl: String,
  sensorTopic: { type: String, default: 'device/stm32/sensor_data' },
  commandTopic: { type: String, default: 'device/stm32/commands' },
  isConnected: Boolean,
  isBusy: Boolean,
  packetCount: { type: Number, default: 0 },
  lastRxText: { type: String, default: '' },
  dataOnline: { type: Boolean, default: null },
  deviceStatusLabel: { type: String, default: '设备 —' },
  deviceStatusClass: { type: String, default: 'dev-off' },
  deviceStatusHint: { type: String, default: '' },
  canEditBroker: { type: Boolean, default: true },
  demoNotice: { type: String, default: '' },
  userLabel: { type: String, default: '本地' },
  /** 来自 getAppConfig.allowedCommands；缺省用 defaults 副本 */
  allowedCommands: { type: Array, default: null },
});
const emit = defineEmits([
  'connect',
  'disconnect',
  'update:brokerUrl',
  'update:sensorTopic',
  'update:commandTopic',
  'open-soft-config',
  'close-soft-config',
  'open-about',
  'close-about',
]);

const subTab = ref(props.softConfigOpen ? 'soft' : 'mqtt');
watch(
  () => props.softConfigOpen,
  (v) => {
    if (v) subTab.value = 'soft';
    else if (subTab.value === 'soft') subTab.value = 'mqtt';
  }
);
const setSub = (tab) => {
  subTab.value = tab;
  if (tab === 'soft') {
    emit('close-about');
    emit('open-soft-config');
  } else {
    emit('close-about');
    emit('close-soft-config');
  }
};
const openAbout = () => {
  emit('close-soft-config');
  emit('open-about');
};

</script>

<style scoped>
.broker-lock-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #f59e0b;
}
.broker-lock-hint.muted {
  color: #636366;
  margin-bottom: 2px;
}
.link-result {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.link-card {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.link-card-title {
  font-size: 11px;
  color: #636366;
  font-weight: 600;
  margin-bottom: 6px;
}
.link-card-value {
  font-size: 14px;
  font-weight: 650;
  color: #111113;
}
.link-card-value.ok,
.link-card-value.dev-on { color: #22c55e; }
.link-card-value.busy,
.link-card-value.dev-wait { color: #f59e0b; }
.link-card-value.bad,
.link-card-value.dev-bad { color: #f87171; }
.link-card-value.dev-off { color: #6b7280; }
.mqtt-meta {
  margin-top: 10px;
}
.settings-section {
  margin-top: 4px;
  padding-top: 2px;
}
.settings-section-head {
  margin-bottom: 8px;
}
.settings-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: #111113;
}
.broker-label {
  display: block;
  font-size: 12px;
  color: #636366;
  margin-bottom: 4px;
}
.broker-input {
  width: 100%;
  box-sizing: border-box;
}
.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.btn-row .btn-success,
.btn-row .btn-danger {
  flex: 1;
  min-height: 44px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: 12px;
  line-height: 1.2;
}
.mqtt-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 4px 0;
}
.mqtt-line .k { color: #636366; }
.mqtt-line .v { color: #111113; font-variant-numeric: tabular-nums; }
.settings-subnav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
}
.settings-subtab {
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 8px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #636366;
  cursor: pointer;
}
.settings-subtab.active {
  background: #fff;
  color: #111113;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.about-footer {
  margin-top: auto;
  padding-top: 18px;
}
.about-link {
  border: none;
  background: none;
  padding: 0;
  color: #007aff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
.about-link:hover {
  text-decoration: underline;
}
.about-link.active {
  color: #0056b3;
  text-decoration: underline;
}

/* YZRT metal */
.settings-subnav {
  background: linear-gradient(90deg, #c9d3d4, #aebbc0) !important;
  border: 1.5px solid #c6ccca;
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.5), inset -1px -1px 1px rgba(156,170,169,0.45);
}
</style>
