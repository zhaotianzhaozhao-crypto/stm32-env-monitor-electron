<template>
  <SidebarPanel title="设备控制">
    <!-- 旋钮选设备类，左下开关开/关，右上连接状态 -->
    <div class="device-knob-panel" :class="{ offline: !isConnected }" @wheel.prevent="onKnobWheel" @click="onKnobClick">
      <div class="device-knob-head">
        <span class="device-knob-title">设备控制</span>
        <span
          class="device-link-status"
          :class="isConnected ? 'on' : 'off'"
          role="status"
        >{{ deviceHeadSub }}</span>
      </div>

      <template v-if="deviceGroups.length">
        <div class="device-bind-field" @click.stop @wheel.stop>
          <span class="device-bind-label">执行设备</span>
          <YzSelect
            :model-value="activeGroup?.id || ''"
            :options="deviceSelectOptions"
            placeholder="请选择执行设备"
            @update:model-value="onPickDevice"
          />
        </div>

        <div class="vol-stage">
          <div
            ref="knobRoot"
            class="vol-knob"
            role="listbox"
            aria-label="设备类旋钮"
            tabindex="0"
            @wheel.prevent="onKnobWheel"
            @keydown.left.prevent="stepCmd(-1)"
            @keydown.right.prevent="stepCmd(1)"
            @keydown.up.prevent="stepCmd(1)"
            @keydown.down.prevent="stepCmd(-1)"
          >
            <button
              v-for="(g, i) in deviceGroups"
              :key="g.id"
              type="button"
              class="cmd-chip"
              role="option"
              :aria-selected="i === cmdIndex"
              :class="{ active: i === cmdIndex, 'is-on': groupIsOn(g) }"
              :style="chipStyle(i)"
              :title="g.title"
              @click.stop="onChipSelect(i)"
            >
              <span class="chip-dot" :data-tone="groupIsOn(g) ? 'on' : 'off'" />
              <span class="chip-name">{{ g.short }}</span>
            </button>

            <div class="lamp-box" aria-hidden="true" :style="lampBoxStyle">
              <div v-for="i in LAMP_COUNT" :key="i" :style="{ '--i': i }">
                <span :class="{ act: i <= activeLamps }" />
              </div>
            </div>

            <div class="light-wrapper">
              <div class="btn-bottom">
                <div class="btn core-face" aria-hidden="true">
                  <div class="light-box" :style="{ rotate: angle + 'deg' }">
                    <div class="light" />
                  </div>
                  <span class="send-core-label">{{ activeGroup?.short || '设备' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="device-knob-foot">
          <button
            type="button"
            class="yz-switch"
            :class="{ on: activeGroupOn, disabled: !canToggle }"
            :disabled="!canToggle"
            :aria-pressed="activeGroupOn ? 'true' : 'false'"
            :title="toggleTitle"
            @click="onToggleSwitch"
          >
            <span class="yz-switch-track">
              <span class="yz-switch-knob" />
            </span>
            <span class="yz-switch-text">{{ activeGroupOn ? '开' : '关' }}</span>
          </button>

          <div class="device-current">
            <span class="device-current-name">{{ activeGroup?.name || '—' }}</span>
            <span class="device-current-cmd">{{ activeCmdPreview }}</span>
          </div>
        </div>
        <p class="device-knob-hint">下拉选设备 · 旋钮切换 · 左下开/关</p>
      </template>
      <p v-else class="device-ctrl-none">
        暂无执行器。请在软件配置添加下发指令。
      </p>
      <WheelOsd :show="showWheelOsd" />
    </div>
  </SidebarPanel>
</template>

<script setup>
/**
 * 设备控制面板
 *
 * 【设备控制】旋钮选设备类；左下开关发开/关；右上连接状态
 * 【环境监测】已拆到 EnvMonitorPanel
 */
import { computed, ref, watch } from 'vue';
import SidebarPanel from './SidebarPanel.vue';
import WheelOsd from './WheelOsd.vue';
import YzSelect from './YzSelect.vue';
import {
  commandLabel,
  typeLabel,
  typeKind,
} from '../composables/useDevices.js';
import {
  groupTxActuators,
  TX_ACTUATOR_TYPE_RANK,
} from '../composables/useSoftConfig.js';
import { useWheelOsd } from '../composables/useWheelOsd.js';

const ANGLE_MIN = -112.5;
const ANGLE_MAX = 112.5;
const LAMP_COUNT = 19;

const props = defineProps({
  isConnected: Boolean,
  devices: { type: Array, default: () => [] },
  txOptions: { type: Array, default: () => [] },
  /** 硬件上行执行器状态（buzzerOn/fanOn/breathOn） */
  hwActuators: { type: Object, default: () => ({}) },
  /** 报警蜂鸣是否激活（无硬件上行时兜底） */
  alarmActive: { type: Boolean, default: false },
});

const emit = defineEmits(['send-command']);

/** —— 设备类分组：与采集卡「绑定执行设备」同源（groupTxActuators） —— */
const rankOfGroup = (g) => {
  const t = String(g?.type || 'custom');
  if (t in TX_ACTUATOR_TYPE_RANK) return TX_ACTUATOR_TYPE_RANK[t];
  return TX_ACTUATOR_TYPE_RANK.custom;
};

const pickOnOff = (commands) => {
  let onCmd = '';
  let offCmd = '';
  const misc = [];
  const ON_NAME_RE = /(开|on)$/i;
  const OFF_NAME_RE = /(关|off)$/i;
  const detectPolarity = (name, fmt) => {
    const n = String(name || '');
    const f = String(fmt || '');
    if (/:on$/i.test(f) || /(?:^|[_\-])on$/i.test(f) || ON_NAME_RE.test(n)) return 'on';
    if (/:off$/i.test(f) || /(?:^|[_\-])off$/i.test(f) || OFF_NAME_RE.test(n)) return 'off';
    return null;
  };
  for (const raw of commands || []) {
    const cmd = String(raw || '').trim();
    if (!cmd) continue;
    const lab = commandLabel(cmd);
    const pol = detectPolarity(lab, cmd);
    if (pol === 'on' && !onCmd) onCmd = cmd;
    else if (pol === 'off' && !offCmd) offCmd = cmd;
    else misc.push(cmd);
  }
  if (!onCmd && misc[0]) onCmd = misc[0];
  if (!offCmd && misc[1]) offCmd = misc[1];
  return { onCmd, offCmd };
};

/**
 * 设备组：旋钮一档一类 / 下拉同一数据源。
 * 优先软件配置·下发指令（与 ChartModal 绑定同源，:on/:off 配对去重）；
 * 再并入 devices 里未覆盖的执行器。跳过 skin:*。
 */
const deviceGroups = computed(() => {
  const fromTx = groupTxActuators(props.txOptions || []);
  const covered = new Set();
  for (const g of fromTx) {
    for (const f of g.formats || []) covered.add(String(f).toLowerCase());
    if (g.onCmd) covered.add(String(g.onCmd).toLowerCase());
    if (g.offCmd) covered.add(String(g.offCmd).toLowerCase());
  }

  const fromDevices = (props.devices || [])
    .filter((d) => typeKind(d.type) === 'actuator')
    .filter((d) => (d.commands || []).length)
    .map((d) => {
      const { onCmd, offCmd } = pickOnOff(d.commands);
      return {
        id: d.id,
        name: d.name || typeLabel(d.type),
        short: d.name || typeLabel(d.type),
        type: d.type,
        onCmd,
        offCmd,
        title: `${d.name || ''} · 开/关`,
        memberIds: [d.id],
        formats: (d.commands || []).map(String),
      };
    })
    .filter((g) => g.onCmd || g.offCmd)
    .filter((g) => {
      const cmds = [g.onCmd, g.offCmd].filter(Boolean).map((c) => c.toLowerCase());
      return !cmds.some((c) => covered.has(c));
    });

  return [...fromTx, ...fromDevices].sort((a, b) => {
    const ra = rankOfGroup(a) - rankOfGroup(b);
    if (ra !== 0) return ra;
    return String(a.name).localeCompare(String(b.name), 'zh');
  });
});

const deviceSelectOptions = computed(() =>
  deviceGroups.value.map((g) => ({
    value: g.id,
    label: g.name,
  })),
);

function onPickDevice(id) {
  const want = String(id || '').trim();
  if (!want) return;
  const i = deviceGroups.value.findIndex((g) => g.id === want);
  if (i < 0) return;
  selectCmd(i);
  pulseWheelOsd();
}

/** 各组乐观开/关状态（无遥测时用） */
const groupPower = ref({});
const selectedGroupId = ref('');

watch(
  () => props.isConnected,
  (ok) => {
    if (!ok) groupPower.value = {};
  },
);

const angle = ref(ANGLE_MIN);
const knobRoot = ref(null);
const { showWheelOsd, pulseWheelOsd } = useWheelOsd(500);
let lastCmdIndex = 0;

const cmdCount = computed(() => Math.max(deviceGroups.value.length, 1));
const cmdIndex = computed(() => indexFromAngle(angle.value));
const activeGroup = computed(() => deviceGroups.value[cmdIndex.value] || null);

const groupIsOn = (g) => {
  if (!g) return false;
  const hw = props.hwActuators || {};
  const kind = String(g.type || '').toLowerCase();
  const fmt = String(g.onCmd || g.offCmd || (g.formats || [])[0] || '').toLowerCase();
  const isBuzzer = kind === 'buzzer' || fmt.includes('buzzer');
  const isFan = kind === 'fan' || fmt.includes('fan');
  const isLight = kind === 'light' || fmt.includes('breath') || fmt.includes('light');
  // 优先硬件真实状态；蜂鸣再回退报警态；最后才用本地乐观开关
  if (isBuzzer) {
    if (hw.buzzerOn !== null && hw.buzzerOn !== undefined) return !!hw.buzzerOn;
    if (props.alarmActive) return true;
  } else if (isFan) {
    if (hw.fanOn !== null && hw.fanOn !== undefined) return !!hw.fanOn;
  } else if (isLight) {
    if (hw.breathOn !== null && hw.breathOn !== undefined) return !!hw.breathOn;
  }
  return groupPower.value[g.id] === true;
};

const activeGroupOn = computed(() => groupIsOn(activeGroup.value));

/** 亮到当前档对应灯珠，与指针/标签同角（最左至少亮 1 颗） */
const activeLamps = computed(() => {
  const p = (clampAngle(angle.value) - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  const t = Math.min(1, Math.max(0, p));
  return Math.round(t * (LAMP_COUNT - 1)) + 1;
});

const lampBoxStyle = {
  '--lamp-min': `${ANGLE_MIN}deg`,
  '--lamp-span': `${ANGLE_MAX - ANGLE_MIN}deg`,
  '--lamp-count': String(LAMP_COUNT),
};

const canToggle = computed(() => {
  const g = activeGroup.value;
  if (!props.isConnected || !g) return false;
  if (activeGroupOn.value) return !!g.offCmd || !!g.onCmd;
  return !!g.onCmd || !!g.offCmd;
});

const toggleTitle = computed(() => {
  const g = activeGroup.value;
  if (!g) return '无设备';
  if (!props.isConnected) return 'MQTT 未连接，无法下发';
  if (activeGroupOn.value) {
    return g.offCmd ? `关闭 · ${g.offCmd}` : `切换 · ${g.onCmd || ''}`;
  }
  return g.onCmd ? `打开 · ${g.onCmd}` : `切换 · ${g.offCmd || ''}`;
});

const activeCmdPreview = computed(() => {
  const g = activeGroup.value;
  if (!g) return '';
  if (activeGroupOn.value) return g.onCmd || g.offCmd || '';
  return g.offCmd || g.onCmd || '';
});

const deviceHeadSub = computed(() => {
  if (!deviceGroups.value.length) return '无设备';
  if (!props.isConnected) return '未连接 · 可预选';
  return `已连接 · ${cmdIndex.value + 1}/${deviceGroups.value.length}`;
});

function clampAngle(a) {
  return Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, a));
}
function angleForIndex(i) {
  const n = cmdCount.value;
  if (n <= 1) return 0;
  return ANGLE_MIN + (i / (n - 1)) * (ANGLE_MAX - ANGLE_MIN);
}
function indexFromAngle(a) {
  const n = cmdCount.value;
  if (n <= 1) return 0;
  const p = (clampAngle(a) - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  return Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
}
function applyAngle(a, { snap = false } = {}) {
  let next = clampAngle(a);
  if (snap) {
    const i = indexFromAngle(next);
    next = angleForIndex(i);
    lastCmdIndex = i;
  }
  angle.value = next;
}
function selectCmd(i) {
  applyAngle(angleForIndex(i), { snap: true });
  const g = deviceGroups.value[i];
  if (g) selectedGroupId.value = g.id;
}
function stepCmd(dir) {
  const i = indexFromAngle(angle.value);
  const n = cmdCount.value;
  const next = Math.min(n - 1, Math.max(0, i + dir));
  selectCmd(next);
  pulseWheelOsd();
}
function onKnobWheel(e) {
  pulseWheelOsd();
  stepCmd(e.deltaY > 0 ? -1 : 1);
}
function onKnobClick() {
  pulseWheelOsd();
}

function onChipSelect(i) {
  selectCmd(i);
  pulseWheelOsd();
}


function chipStyle(i) {
  const deg = angleForIndex(i);
  const r = 108;
  const rad = (deg * Math.PI) / 180;
  const x = Math.sin(rad) * r;
  const y = -Math.cos(rad) * r;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
  };
}

watch(
  () => deviceGroups.value.map((g) => g.id).join('|'),
  () => {
    const list = deviceGroups.value;
    if (!list.length) {
      angle.value = 0;
      lastCmdIndex = 0;
      selectedGroupId.value = '';
      return;
    }
    let i = list.findIndex((g) => g.id === selectedGroupId.value);
    if (i < 0) i = Math.min(Math.max(lastCmdIndex, 0), list.length - 1);
    selectedGroupId.value = list[i].id;
    applyAngle(angleForIndex(i), { snap: true });
    const next = { ...groupPower.value };
    for (const g of list) {
      if (next[g.id] === undefined) next[g.id] = false;
    }
    groupPower.value = next;
  },
  { immediate: true },
);

const onToggleSwitch = () => {
  const g = activeGroup.value;
  if (!g || !props.isConnected) return;
  const turningOn = !groupIsOn(g);
  let cmd = '';
  if (turningOn) cmd = g.onCmd || g.offCmd;
  else cmd = g.offCmd || g.onCmd;
  if (!cmd) return;
  groupPower.value = { ...groupPower.value, [g.id]: turningOn };
  emit('send-command', { id: g.id, name: g.name, cmd });
};
</script>

<style scoped>
.device-knob-panel {
  margin-top: 0;
  padding: 10px 8px 8px;
  border-radius: 18px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(145deg, rgba(234,239,237,0.96), rgba(149,167,174,0.42));
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.5), 10px 0 18px rgba(2,29,37,0.12);
}
.device-knob-panel.offline { opacity: 0.92; }
.device-knob-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
  padding: 0 4px;
}
.device-bind-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0 6px 8px;
}
.device-bind-label {
  font-size: 11px;
  color: #6a7d83;
  font-weight: 650;
}
.device-bind-field :deep(.yz-select-trigger) {
  min-height: 34px;
  border-radius: 12px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5);
}
.device-knob-title {
  font-size: 12px;
  font-weight: 700;
  color: #2a3a3e;
}
.device-link-status {
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  color: #6a7d83;
  box-shadow: -2px 0 4px rgba(255,255,255,0.35), 3px 0 6px rgba(2,29,37,0.1);
}
.device-link-status.on {
  color: #1b7a34;
  border-color: rgba(52, 199, 89, 0.45);
  box-shadow: 0 0 0 1px rgba(52, 199, 89, 0.2), 3px 0 6px rgba(2,29,37,0.1);
}
.device-link-status.off {
  color: #6a7d83;
}
.vol-stage {
  position: relative;
  width: 100%;
  max-width: 280px;
  height: 248px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}
.vol-knob {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  box-shadow: 0 0 2px #9fa5a3, 10px 0 18px rgba(2, 29, 37, 0.2);
  background-image: linear-gradient(90deg, #dfe4e1, #bfc9ca);
  outline: none;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.vol-knob:active {
  cursor: grabbing;
}
.vol-knob:focus-visible {
  box-shadow: 0 0 0 3px rgba(227, 165, 96, 0.4), 0 0 2px #9fa5a3, 10px 0 18px rgba(2, 29, 37, 0.2);
}
.cmd-chip {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 54px;
  padding: 0;
  border: none;
  background: transparent;
  color: #2a3a3e;
  cursor: pointer;
}
.cmd-chip .chip-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  background: #6a7d83;
}
.cmd-chip .chip-dot[data-tone='on'] { background: #34c759; }
.cmd-chip .chip-dot[data-tone='off'] { background: #8e8e93; }
.cmd-chip .chip-dot[data-tone='misc'] { background: #e3a560; }
.cmd-chip .chip-name {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
  max-width: 54px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}
.cmd-chip.active .chip-dot {
  box-shadow: 0 0 0 2px #e3a560, 0 0 8px rgba(227, 165, 96, 0.45);
}
.cmd-chip.active .chip-name { color: #3d6f82; }

.lamp-box {
  position: absolute;
  z-index: 5;
  width: 202px;
  height: 202px;
  pointer-events: none;
}
.lamp-box > div {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  justify-content: center;
  /* 与 chip/指针同一角度：ANGLE_MIN + span*(i-1)/(count-1) */
  transform: translate(-50%, -50%) rotate(
    calc(
      var(--lamp-min, -112.5deg) + var(--lamp-span, 225deg) * (var(--i) - 1) / (var(--lamp-count, 19) - 1)
    )
  );
  width: 24px;
  height: 168px;
}
.lamp-box span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6a7d83;
  transition: background 0.2s, box-shadow 0.2s;
}
.lamp-box span.act {
  background: #fff;
  box-shadow: 0 0 5px #fff;
  filter: blur(0.6px);
  position: relative;
}
.lamp-box span.act::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 105%;
  height: 105%;
  border-radius: 50%;
  background: #fff;
  filter: blur(3px);
}
.light-wrapper {
  width: 180px;
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  border: 1.5px solid #c6ccca;
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.6),
    inset -1px -1px 1px rgba(170, 184, 183, 0.6);
  background-image: linear-gradient(90deg, #eaefed, #95a7ae);
  pointer-events: none;
}
.btn-bottom {
  width: 140px;
  height: 140px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  border: 1.5px solid #c6ccca;
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.5),
    inset -1px -1px 1px rgba(156, 170, 169, 0.6);
  background-image: linear-gradient(90deg, #dae1de, #a4b6c1);
  pointer-events: none;
}
.btn {
  position: relative;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background-image: linear-gradient(90deg, #dde3df, #acbfc5);
  box-shadow:
    -8px 0 12px rgba(255, 255, 255, 0.4),
    3px 0 6px rgba(2, 29, 37, 0.1),
    16px 0 22px rgba(2, 29, 37, 0.55),
    inset -2px 0 2px rgba(1, 22, 25, 0.4),
    inset 2px 0 2px rgba(255, 255, 255, 0.4);
}
.core-face {
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-core-label {
  position: absolute;
  left: 50%;
  top: 58%;
  transform: translate(-50%, -50%);
  z-index: 3;
  font-size: 12px;
  font-weight: 750;
  color: #2a3a3e;
  text-shadow: 0 1px 0 rgba(255,255,255,0.55);
  pointer-events: none;
  max-width: 72%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.light-box {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transition: rotate 0.18s ease-out;
  position: relative;
  pointer-events: none;
}
.vol-knob:active .light-box { transition: none; }
.light {
  position: absolute;
  left: 50%;
  top: 17%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 18px;
  border-radius: 99px;
  background-image: linear-gradient(0deg, rgba(255,255,255,0.6), #fff, rgba(255,255,255,0.6));
  box-shadow: 0 0 5px #fff;
}
.light::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  filter: blur(4px);
}
.light.off {
  background-image: none;
  background: #6a7d83;
  box-shadow: none;
}
.light.off::after { background: transparent; }

.device-knob-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  padding: 0 6px;
}
.yz-switch {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 6px;
  border-radius: 999px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  box-shadow: -3px 0 5px rgba(255,255,255,0.4), 4px 0 8px rgba(2,29,37,0.14);
  cursor: pointer;
  color: #2a3a3e;
}
.yz-switch:disabled,
.yz-switch.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.yz-switch-track {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(180deg, #95a7ae, #bfc9ca);
  box-shadow: inset 0 1px 3px rgba(2, 29, 37, 0.28), inset 0 -1px 0 rgba(255,255,255,0.25);
  transition: background 0.2s ease;
}
.yz-switch.on .yz-switch-track {
  background: linear-gradient(180deg, #3d9a5a, #34c759);
  border-color: rgba(52, 199, 89, 0.65);
}
.yz-switch-knob {
  position: absolute;
  top: 1px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f4f7f6, #c5d0d3);
  border: 1px solid #c6ccca;
  box-shadow: -2px 0 3px rgba(255,255,255,0.5), 3px 0 5px rgba(2,29,37,0.22);
  transition: transform 0.2s cubic-bezier(0.22, 0.82, 0.24, 1);
}
.yz-switch.on .yz-switch-knob {
  transform: translateX(18px);
}
.yz-switch-text {
  font-size: 12px;
  font-weight: 750;
  min-width: 1.2em;
}
.device-current {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.device-current-name {
  font-size: 12px;
  font-weight: 700;
  color: #2a3a3e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.device-current-cmd {
  font-size: 10px;
  font-weight: 600;
  color: #6a7d83;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.device-knob-hint {
  margin: 6px 0 0;
  text-align: center;
  font-size: 10px;
  font-weight: 650;
  color: #6a7d83;
}
.device-ctrl-none {
  font-size: 11px;
  color: #6a7d83;
  line-height: 1.35;
  margin: 8px 4px;
}

</style>

