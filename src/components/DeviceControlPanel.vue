<template>
  <SidebarPanel title="设备控制">
    <div class="device-wheel-panel" @wheel.prevent.stop="onPanelWheel">
      <div class="device-wheel-head">
        <span class="device-wheel-kicker">设备控制</span>
        <span
          class="device-link-status"
          :class="isConnected ? 'on' : 'off'"
          role="status"
        >{{ deviceHeadSub }}</span>
      </div>

      <template v-if="deviceGroups.length">
        <RadialWheelMenu
          ref="wheelRef"
          :items="wheelItems"
          :index="cmdIndex"
          :entered="entered"
          :active="active"
          :can-toggle="canToggle"
          :toggle-title="toggleTitle"
          @select="onSelect"
          @step="onStep"
          @enter="onEnter"
          @leave="onLeave"
          @toggle="onToggleSwitch"
        />
        <p class="device-wheel-hint">{{ hint }}</p>
      </template>
      <p v-else class="device-ctrl-none">
        暂无执行器。请在软件配置添加下发指令。
      </p>
    </div>
  </SidebarPanel>
</template>

<script setup>
/**
 * 设备控制：平级执行器收成一只径向轮盘。
 * 旋转只预览（中心 HUD 跟选中项走），短按 / 点击进入后再开/关。
 * 下发仍走 send-command，协议串与白名单不在这里改。
 */
import { computed, ref, watch } from 'vue';
import SidebarPanel from './SidebarPanel.vue';
import RadialWheelMenu from './RadialWheelMenu.vue';
import {
  commandLabel,
  typeLabel,
  typeKind,
} from '../composables/useDevices.js';
import {
  groupTxActuators,
  TX_ACTUATOR_TYPE_RANK,
} from '../composables/useSoftConfig.js';

const props = defineProps({
  isConnected: Boolean,
  devices: { type: Array, default: () => [] },
  txOptions: { type: Array, default: () => [] },
  /** 硬件上行执行器状态（buzzerOn/fanOn/breathOn） */
  hwActuators: { type: Object, default: () => ({}) },
  /** 报警蜂鸣是否激活（无硬件上行时兜底） */
  alarmActive: { type: Boolean, default: false },
  temp: { default: '--' },
  humidity: { default: '--' },
  /** 设备控制页是否正在显示（隐藏时忽略编码器） */
  active: { type: Boolean, default: true },
  /** useSensorData：CW +1 / CCW -1，重复同向也会变 */
  encoderPulse: { type: Number, default: 0 },
});

const emit = defineEmits(['send-command']);

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
 * 设备组：轮盘一扇区一类。
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

const groupPower = ref({});
const selectedGroupId = ref('');
const cmdIndex = ref(0);
const entered = ref(false);
const wheelRef = ref(null);

watch(
  () => props.isConnected,
  (ok) => {
    if (!ok) groupPower.value = {};
  },
);

watch(
  () => props.active,
  (on) => {
    if (!on) wheelRef.value?.blurWheel?.();
  },
);

const groupIsOn = (g) => {
  if (!g) return false;
  const hw = props.hwActuators || {};
  const kind = String(g.type || '').toLowerCase();
  const fmt = String(g.onCmd || g.offCmd || (g.formats || [])[0] || '').toLowerCase();
  const isBuzzer = kind === 'buzzer' || fmt.includes('buzzer');
  const isFan = kind === 'fan' || fmt.includes('fan');
  const isLight = kind === 'light' || fmt.includes('breath') || fmt.includes('light');
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

const activeGroup = computed(() => deviceGroups.value[cmdIndex.value] || null);
const activeGroupOn = computed(() => groupIsOn(activeGroup.value));

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

const deviceHeadSub = computed(() => {
  const list = deviceGroups.value;
  if (!list.length) return '无设备';
  const pos = `${String(cmdIndex.value + 1).padStart(2, '0')}/${String(list.length).padStart(2, '0')}`;
  if (!props.isConnected) return `未连接 · ${pos}`;
  return `已连接 · ${pos}`;
});

const hint = computed(() => (
  entered.value
    ? '开/关下发当前设备 · Esc 或「返回」回到轮盘'
    : '编码器、滚轮、拖转或方向键切换 · 点击扇区或中心进入'
));

function hasReading(v) {
  if (v === null || v === undefined || v === '' || v === '--') return false;
  const n = Number(v);
  return Number.isFinite(n) || String(v).trim() !== '';
}

function fmtReading(v, unit) {
  if (!hasReading(v)) return `--${unit}`;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${v}${unit}`;
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}${unit}`;
}

function subtitleFor(g) {
  const map = { fan: 'COOLING', light: 'AMBIENT', buzzer: 'ALERT' };
  const kind = String(g.type || '').toLowerCase();
  if (map[kind]) return map[kind];
  const raw = String(g.onCmd || g.offCmd || 'device');
  const key = raw.split(':')[0].replace(/[^a-z0-9]+/gi, '');
  return (key || 'device').toUpperCase().slice(0, 12);
}

function liveParam(g, on) {
  const state = on ? '开' : '关';
  const kind = String(g.type || '').toLowerCase();
  if (kind === 'fan') {
    const t = fmtReading(props.temp, '℃');
    const h = hasReading(props.humidity) ? `  ${fmtReading(props.humidity, '%')}` : '';
    return `${t}${h}  ${state}`;
  }
  if (kind === 'buzzer') return on ? '报警  鸣响' : '静音  关';
  if (kind === 'light') return `灯光  ${state}`;
  return state;
}

function sectorText(name, count) {
  const max = count >= 8 ? 1 : 2;
  return Array.from(String(name || '').trim()).slice(0, max).join('');
}

let panelWheelAcc = 0;
function onPanelWheel(e) {
  if (!props.active || !deviceGroups.value.length) return;
  if (e.target?.closest?.('.rw')) return;
  const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 40 : 1;
  const dy = raw * scale;
  if (Math.abs(dy) >= 40) {
    panelWheelAcc = 0;
    onStep(dy > 0 ? 1 : -1);
    return;
  }
  panelWheelAcc += dy;
  if (Math.abs(panelWheelAcc) < 40) return;
  const dir = panelWheelAcc > 0 ? 1 : -1;
  panelWheelAcc = 0;
  onStep(dir);
}

const wheelItems = computed(() => {
  const list = deviceGroups.value;
  const n = list.length;
  return list.map((g) => {
    const on = groupIsOn(g);
    const command = on ? (g.onCmd || g.offCmd || '') : (g.offCmd || g.onCmd || '');
    return {
      id: g.id,
      short: g.short || g.name,
      sectorText: sectorText(g.short || g.name, n),
      subtitle: subtitleFor(g),
      param: liveParam(g, on),
      command,
      on,
    };
  });
});

function onSelect(i) {
  const list = deviceGroups.value;
  if (!list.length) return;
  const n = list.length;
  const idx = ((Number(i) % n) + n) % n;
  cmdIndex.value = idx;
  selectedGroupId.value = list[idx].id;
}

function onStep(dir) {
  onSelect(cmdIndex.value + (Number(dir) < 0 ? -1 : 1));
}

function onEnter() {
  if (!deviceGroups.value.length) return;
  entered.value = true;
}

function onLeave() {
  entered.value = false;
}

watch(
  () => deviceGroups.value.map((g) => g.id).join('|'),
  () => {
    const list = deviceGroups.value;
    if (!list.length) {
      cmdIndex.value = 0;
      selectedGroupId.value = '';
      entered.value = false;
      return;
    }
    let i = list.findIndex((g) => g.id === selectedGroupId.value);
    if (i < 0) i = Math.min(Math.max(cmdIndex.value, 0), list.length - 1);
    selectedGroupId.value = list[i].id;
    cmdIndex.value = i;
    const next = { ...groupPower.value };
    for (const g of list) {
      if (next[g.id] === undefined) next[g.id] = false;
    }
    groupPower.value = next;
  },
  { immediate: true },
);

watch(
  () => props.encoderPulse,
  (v, prev) => {
    if (!props.active) return;
    if (prev === undefined || v === prev) return;
    onStep(v > prev ? 1 : -1);
  },
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
.device-wheel-panel {
  margin-top: 0;
  padding: 10px 8px 8px;
  border-radius: 18px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(145deg, rgba(234, 239, 237, 0.96), rgba(149, 167, 174, 0.42));
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), 10px 0 18px rgba(2, 29, 37, 0.12);
}
.device-wheel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
  padding: 0 4px;
}
.device-wheel-kicker {
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
  box-shadow: -2px 0 4px rgba(255, 255, 255, 0.35), 3px 0 6px rgba(2, 29, 37, 0.1);
}
.device-link-status.on {
  color: #1b7a34;
  border-color: rgba(52, 199, 89, 0.45);
  box-shadow: 0 0 0 1px rgba(52, 199, 89, 0.2), 3px 0 6px rgba(2, 29, 37, 0.1);
}
.device-link-status.off { color: #6a7d83; }
.device-wheel-hint {
  margin: 8px 4px 0;
  text-align: center;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.45;
  color: #6a7d83;
}
.device-ctrl-none {
  font-size: 11px;
  color: #6a7d83;
  line-height: 1.35;
  margin: 8px 4px;
}
</style>
