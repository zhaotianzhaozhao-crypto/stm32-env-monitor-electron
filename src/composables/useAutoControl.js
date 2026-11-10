/**
 * 智能家居中控：手动/自动模式 + 场景一键下发 + 自动高温开风扇
 *
 * 【模式】localStorage `naijiaren.controlMode` = manual | auto
 * 【自动】仅 AUTO 且已连接：温度 ≥ 上限上升沿 fan:on，回落下降沿 fan:off（不刷屏）
 * 【联动】forceMode 非空时跳过自动（与 useAlarm 手动强制一致）
 * 【场景】回家/离家/睡觉/通风 → 白名单指令序列，间隔下发并记日志
 */
import { ref, computed } from 'vue';
import { listAllowedCommands } from './useDevices.js';

const MODE_KEY = 'naijiaren.controlMode';

/** 场景表：仅用固件已知协议串 */
export const CONTROL_SCENES = [
  {
    id: 'home',
    name: '回家',
    hint: '开灯 · 关风扇 · 消蜂鸣',
    cmds: ['breath:on', 'fan:off', 'buzzer:off'],
  },
  {
    id: 'away',
    name: '离家',
    hint: '关灯 · 关风扇 · 消蜂鸣',
    cmds: ['breath:off', 'fan:off', 'buzzer:off'],
  },
  {
    id: 'sleep',
    name: '睡觉',
    hint: '关灯 · 关风扇 · 消蜂鸣',
    cmds: ['breath:off', 'fan:off', 'buzzer:off'],
  },
  {
    id: 'vent',
    name: '通风',
    hint: '开风扇 · 开灯',
    cmds: ['fan:on', 'breath:on'],
  },
];

function loadMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'auto' ? 'auto' : 'manual';
  } catch {
    return 'manual';
  }
}

function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 是否有风扇类设备且绑了对应指令 */
function hasFanCommand(devices, cmd) {
  const list = Array.isArray(devices) ? devices : [];
  return list.some((d) => {
    if (!d) return false;
    const cmds = d.commands || [];
    if (!cmds.includes(cmd)) return false;
    // 优先 fan 类型；也允许自定义绑了 fan:* 的设备
    return d.type === 'fan' || cmds.some((c) => String(c).startsWith('fan:'));
  });
}

function fanDeviceName(devices) {
  const list = Array.isArray(devices) ? devices : [];
  const fan = list.find((d) => d.type === 'fan') ||
    list.find((d) => (d.commands || []).some((c) => String(c).startsWith('fan:')));
  return fan?.name || '风扇';
}

/**
 * @param {object} opts
 * @param {import('vue').Ref|import('vue').ComputedRef} opts.isConnected
 * @param {(cmd:string)=>any} opts.sendCommand
 * @param {(msg:string)=>void} [opts.addLog]
 * @param {(msg:string)=>void} [opts.toastOk]
 * @param {(msg:string)=>void} [opts.toastBad]
 * @param {import('vue').Ref} [opts.forceMode] useAlarm.forceMode
 * @param {()=>any[]} opts.getDevices 返回当前设备清单
 */
export function useAutoControl({
  isConnected,
  sendCommand,
  addLog,
  toastOk,
  toastBad,
  forceMode,
  getDevices,
}) {
  const controlMode = ref(loadMode());
  /** 自动风扇当前是否认为已开（边缘触发用） */
  const fanAutoOn = ref(false);
  const sceneBusy = ref(false);

  const isAuto = computed(() => controlMode.value === 'auto');
  const isManual = computed(() => controlMode.value === 'manual');

  const setControlMode = (mode) => {
    const m = mode === 'auto' ? 'auto' : 'manual';
    controlMode.value = m;
    saveMode(m);
    addLog?.(m === 'auto' ? '【中控】切换为自动模式' : '【中控】切换为手动模式');
    // 切回手动时清自动风扇状态，避免下次 AUTO 误判
    if (m === 'manual') fanAutoOn.value = false;
  };

  const allow = (cmd) => (listAllowedCommands() || []).includes(cmd);

  /** 单条下发（已连 + 白名单）；失败返回 false */
  const dispatch = (cmd, tag) => {
    const s = String(cmd || '').trim();
    if (!s) return false;
    if (!allow(s)) {
      addLog?.(`${tag}指令未在白名单：${s}`);
      return false;
    }
    if (!isConnected.value) {
      addLog?.(`${tag}MQTT 未连接，未发送 ${s}`);
      return false;
    }
    try {
      sendCommand?.(s);
      return true;
    } catch (e) {
      addLog?.(`${tag}下发失败: ${e?.message || e}`);
      return false;
    }
  };

  /**
   * 自动联动：温度超上限 → fan:on；回落后 → fan:off
   * @param {number|string} tempRaw
   * @param {number} tempMaxVal
   */
  const checkAutoFan = (tempRaw, tempMaxVal) => {
    if (controlMode.value !== 'auto') return;
    if (!isConnected.value) return;
    const fm = forceMode?.value;
    if (fm === 'on' || fm === 'off') return; // 手动强制期间跳过

    const t = Number(tempRaw);
    const max = Number(tempMaxVal);
    if (!Number.isFinite(t) || !Number.isFinite(max)) return;

    const devices = typeof getDevices === 'function' ? getDevices() : [];
    const hot = t >= max;
    const name = fanDeviceName(devices);

    if (hot && !fanAutoOn.value) {
      if (!hasFanCommand(devices, 'fan:on')) {
        addLog?.('【自动】高温需开风扇，但无风扇设备或未绑 fan:on');
        return;
      }
      if (dispatch('fan:on', '【自动·高温开风扇】')) {
        fanAutoOn.value = true;
        addLog?.(`【自动·高温开风扇】「${name}」→ fan:on（${t}℃ ≥ ${max}℃）`);
      }
    } else if (!hot && fanAutoOn.value) {
      if (!hasFanCommand(devices, 'fan:off')) {
        fanAutoOn.value = false;
        return;
      }
      if (dispatch('fan:off', '【自动·温度回落关风扇】')) {
        fanAutoOn.value = false;
        addLog?.(`【自动·温度回落关风扇】「${name}」→ fan:off（${t}℃ < ${max}℃）`);
      }
    }
  };

  /**
   * 场景一键下发：顺序发送，短间隔
   * @param {string} sceneId
   * @param {{ delayMs?: number }} [opts]
   */
  const runScene = async (sceneId, { delayMs = 180 } = {}) => {
    const scene = CONTROL_SCENES.find((s) => s.id === sceneId);
    if (!scene) return false;
    if (sceneBusy.value) {
      toastBad?.('场景下发中，请稍候');
      return false;
    }
    if (!isConnected.value) {
      addLog?.(`【场景·${scene.name}】MQTT 未连接，未下发`);
      toastBad?.('MQTT 未连接，无法下发场景');
      return false;
    }

    sceneBusy.value = true;
    addLog?.(`【场景·${scene.name}】开始下发 ${scene.cmds.length} 条指令`);
    let ok = 0;
    let fail = 0;
    try {
      for (const cmd of scene.cmds) {
        const devices = typeof getDevices === 'function' ? getDevices() : [];
        // 找绑了该指令的设备名记日志
        const owner = devices.find((d) => (d.commands || []).includes(cmd));
        const label = owner?.name || cmd.split(':')[0];
        if (dispatch(cmd, `【场景·${scene.name}】`)) {
          ok += 1;
          addLog?.(`【场景·${scene.name}】「${label}」→ ${cmd}`);
        } else {
          fail += 1;
        }
        if (delayMs > 0) await sleep(delayMs);
      }
      if (fail === 0) {
        toastOk?.(`场景「${scene.name}」已下发`);
        addLog?.(`【场景·${scene.name}】完成（${ok}/${scene.cmds.length}）`);
        return true;
      }
      toastBad?.(`场景「${scene.name}」部分失败（成功 ${ok}，失败 ${fail}）`);
      addLog?.(`【场景·${scene.name}】结束：成功 ${ok}，失败 ${fail}`);
      return false;
    } finally {
      sceneBusy.value = false;
    }
  };

  return {
    controlMode,
    isAuto,
    isManual,
    sceneBusy,
    fanAutoOn,
    setControlMode,
    checkAutoFan,
    runScene,
    CONTROL_SCENES,
  };
}
