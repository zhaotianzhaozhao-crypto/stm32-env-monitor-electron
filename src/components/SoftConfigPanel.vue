<template>
  <div class="soft-config-panel" role="region" aria-label="软件配置">
    <header class="scf-header">
      <div class="scf-title-block">
        <h2 class="scf-title">软件配置</h2>
        <p class="scf-sub">接收 = 数据通道（硬件→软件）· 下发 = 硬件控制（软件→硬件）。保存后可在「环境监测 → 采集卡」按名称选用。</p>
      </div>
      <button type="button" class="scf-close" title="关闭，返回模型" @click="$emit('close')">×</button>
    </header>

    <div class="scf-body-wrap">
    <div ref="bodyRef" class="scf-body" @scroll.passive="onBodyScroll">
      <!-- 接收指令 -->
      <section id="scf-sec-rx" class="scf-card" data-sec="0">
        <header class="scf-card-head">
          <h3>接收指令</h3>
          <span class="scf-badge">硬件 → 软件 · 数据通道</span>
        </header>
        <p class="scf-hint">格式填写 JSON 片段或键名，如 <code>"temp":24.7</code>；软件只认键名，数字仅为示例。</p>
        <div class="scf-table-wrap">
          <table class="scf-table">
            <thead>
              <tr>
                <th class="col-name">名称</th>
                <th class="col-fmt">格式</th>
                <th class="col-key">解析键</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in rxDraft" :key="row.id || i">
                <td>
                  <input v-model="row.name" class="scf-input" type="text" maxlength="32" placeholder="如：温度传感器" />
                </td>
                <td>
                  <input v-model="row.format" class="scf-input mono" type="text" maxlength="64" placeholder='"temp":24.7' spellcheck="false" />
                </td>
                <td class="key-cell"><code>{{ previewKey(row.format) || '—' }}</code></td>
                <td>
                  <button type="button" class="scf-icon-btn" title="删除" @click="removeRx(i)">删</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scf-actions">
          <button type="button" class="scf-btn ghost" @click="addRx">＋ 用户自定义</button>
          <button type="button" class="scf-btn ghost" @click="resetRx">恢复默认</button>
          <button type="button" class="scf-btn primary" @click="onSaveRx">保存接收</button>
        </div>
      </section>

      <!-- 下发指令 -->
      <section id="scf-sec-tx" class="scf-card" data-sec="1">
        <header class="scf-card-head">
          <h3>下发指令</h3>
          <span class="scf-badge send">软件 → 硬件 · 控制</span>
        </header>
        <p class="scf-hint">格式为整串指令，如 <code>buzzer:on</code>；<code>:on</code>/<code>:off</code> 报警时可自动配对。保存后写入主进程白名单。</p>
        <div class="scf-table-wrap">
          <table class="scf-table">
            <thead>
              <tr>
                <th class="col-name">名称</th>
                <th class="col-fmt">格式</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in txDraft" :key="row.id || i">
                <td>
                  <input v-model="row.name" class="scf-input" type="text" maxlength="32" placeholder="如：蜂鸣开" />
                </td>
                <td>
                  <input v-model="row.format" class="scf-input mono" type="text" maxlength="64" placeholder="buzzer:on" spellcheck="false" />
                </td>
                <td>
                  <button type="button" class="scf-icon-btn" title="删除" @click="removeTx(i)">删</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scf-actions">
          <button type="button" class="scf-btn ghost" @click="addTx">＋ 用户自定义</button>
          <button type="button" class="scf-btn ghost" @click="resetTx">恢复默认</button>
          <button type="button" class="scf-btn primary" @click="onSaveTx">保存下发</button>
        </div>
      </section>
    </div>

    <nav class="scf-dash-nav" aria-label="分区导航">
      <span class="scf-dash-indicator" :style="{ transform: `translateY(${activeSec * DASH_STEP}px)` }" />
      <button
        v-for="(sec, i) in SECTIONS"
        :key="sec.id"
        type="button"
        class="scf-dash"
        :class="{ active: activeSec === i }"
        :aria-label="sec.title"
        @click="jumpTo(i)"
      >
        <span class="scf-dash-tip"><em>{{ String(i + 1).padStart(2, '0') }}</em>{{ sec.title }}</span>
        <i class="scf-dash-bar" />
      </button>
    </nav>
    </div>

    <footer v-if="hint" class="scf-footer">{{ hint }}</footer>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { extractJsonKey } from '../composables/useSoftConfig.js';

const props = defineProps({
  rxCommands: { type: Array, default: () => [] },
  txCommands: { type: Array, default: () => [] },
  hint: { type: String, default: '' },
});

const emit = defineEmits(['close', 'save-rx', 'save-tx', 'reset-rx', 'reset-tx']);

const cloneRows = (list) =>
  (Array.isArray(list) ? list : []).map((r) => ({
    id: r.id,
    name: r.name,
    format: r.format,
    key: r.key,
  }));

const rxDraft = ref(cloneRows(props.rxCommands));
const txDraft = ref(cloneRows(props.txCommands));

watch(
  () => props.rxCommands,
  (v) => {
    rxDraft.value = cloneRows(v);
  },
  { deep: true }
);
watch(
  () => props.txCommands,
  (v) => {
    txDraft.value = cloneRows(v);
  },
  { deep: true }
);

const previewKey = (fmt) => extractJsonKey(fmt);

const addRx = () => {
  rxDraft.value.push({
    id: `rx_new_${Date.now().toString(36)}`,
    name: '',
    format: '',
  });
};
const addTx = () => {
  txDraft.value.push({
    id: `tx_new_${Date.now().toString(36)}`,
    name: '',
    format: '',
  });
};
const removeRx = (i) => {
  rxDraft.value.splice(i, 1);
};
const removeTx = (i) => {
  txDraft.value.splice(i, 1);
};

const onSaveRx = () => emit('save-rx', cloneRows(rxDraft.value));
const onSaveTx = () => emit('save-tx', cloneRows(txDraft.value));
const resetRx = () => emit('reset-rx');
const resetTx = () => emit('reset-tx');

/* 右侧短横线分区导航：点击跳转 + 滚动跟随 */
const SECTIONS = [
  { id: 'scf-sec-rx', title: '接收指令' },
  { id: 'scf-sec-tx', title: '下发指令' },
];
const DASH_STEP = 22;
const bodyRef = ref(null);
const activeSec = ref(0);
const onBodyScroll = () => {
  const body = bodyRef.value;
  if (!body) return;
  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) {
    activeSec.value = SECTIONS.length - 1;
    return;
  }
  const top = body.getBoundingClientRect().top + 40;
  let idx = 0;
  SECTIONS.forEach((sec, i) => {
    const el = body.querySelector(`#${sec.id}`);
    if (el && el.getBoundingClientRect().top <= top) idx = i;
  });
  activeSec.value = idx;
};
const jumpTo = (i) => {
  const body = bodyRef.value;
  const el = body?.querySelector(`#${SECTIONS[i].id}`);
  if (!el) return;
  activeSec.value = i;
  body.scrollTo({ top: el.offsetTop - body.offsetTop, behavior: 'smooth' });
};
onMounted(() => nextTick(onBodyScroll));
</script>

<style scoped>
.soft-config-panel {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 18px 20px 16px;
  border-radius: inherit;
  background:
    radial-gradient(900px 520px at 50% 38%, rgba(255, 255, 255, 0.98), transparent 62%),
    linear-gradient(180deg, #f7f8fa 0%, #eef0f3 48%, #e8ebf0 100%);
  color: #111113;
  overflow: hidden;
}
.scf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-shrink: 0;
}
.scf-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.scf-sub {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #636366;
  max-width: 640px;
}
.scf-close {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  color: #3a3a3c;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.scf-close:hover {
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
}
.scf-body-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.scf-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 40px;
  scroll-behavior: smooth;
  scrollbar-width: none;
}
.scf-body::-webkit-scrollbar { display: none; }
.scf-dash-nav {
  position: absolute;
  top: 8px;
  right: 2px;
  width: 30px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 2;
}
.scf-dash {
  position: relative;
  width: 30px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.scf-dash-bar {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 2px;
  background: #c6ccca;
  transition: width 0.25s ease, background 0.25s ease;
}
.scf-dash:hover .scf-dash-bar { width: 24px; background: #8a9a9f; }
.scf-dash.active .scf-dash-bar { width: 26px; background: #b8c3c6; }
.scf-dash-indicator {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: #e5484d;
  z-index: 1;
  pointer-events: none;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.scf-dash-tip {
  position: absolute;
  right: 40px;
  top: 50%;
  transform: translate(6px, -50%);
  white-space: nowrap;
  padding: 6px 14px;
  border-radius: 999px;
  background: #1c1c1e;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.scf-dash-tip::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  border-left: 6px solid #1c1c1e;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
}
.scf-dash-tip em {
  font-style: normal;
  color: #e5484d;
  margin-right: 6px;
}
.scf-dash:hover .scf-dash-tip {
  opacity: 1;
  transform: translate(0, -50%);
}
.scf-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  padding: 14px 16px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}
.scf-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.scf-card-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}
.scf-badge {
  font-size: 11px;
  font-weight: 600;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 980px;
  padding: 2px 8px;
}
.scf-badge.send {
  color: #af52de;
  background: rgba(175, 82, 222, 0.12);
}
.scf-hint {
  margin: 0 0 10px;
  font-size: 11px;
  color: #8e8e93;
  line-height: 1.4;
}
.scf-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 5px;
  border-radius: 4px;
}
.scf-table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.scf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.scf-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #636366;
  background: rgba(0, 0, 0, 0.03);
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.scf-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  vertical-align: middle;
}
.scf-table tr:last-child td {
  border-bottom: none;
}
.col-name { width: 28%; }
.col-fmt { width: 42%; }
.col-key { width: 18%; }
.col-act { width: 48px; }
.scf-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 13px;
  background: #fff;
  color: #111113;
  outline: none;
}
.scf-input:focus {
  border-color: rgba(0, 122, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
}
.scf-input.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.key-cell code {
  font-size: 12px;
  color: #007aff;
  font-weight: 600;
}
.scf-icon-btn {
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11px;
  color: #636366;
  cursor: pointer;
}
.scf-icon-btn:hover {
  color: #ff3b30;
  border-color: rgba(255, 59, 48, 0.35);
}
.scf-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}
.scf-btn {
  border-radius: 980px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.scf-btn.ghost {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.12);
  color: #3a3a3c;
}
.scf-btn.primary {
  background: #007aff;
  color: #fff;
}
.scf-btn.primary:hover {
  filter: brightness(1.05);
}
.scf-footer {
  flex-shrink: 0;
  margin-top: 10px;
  font-size: 12px;
  color: #248a3d;
  font-weight: 600;
}

/* YZRT metal */
.soft-config-panel {
  background: linear-gradient(145deg, rgba(234, 239, 237, 0.92), rgba(174, 194, 202, 0.88)) !important;
  border: 1.5px solid #c6ccca !important;
  box-shadow:
    -8px 0 14px rgba(255, 255, 255, 0.3),
    12px 0 24px rgba(2, 29, 37, 0.22),
    inset 1px 1px 2px rgba(255, 255, 255, 0.5) !important;
}
.scf-card {
  background: linear-gradient(90deg, #eaefed, #95a7ae) !important;
  border: 1.5px solid #c6ccca !important;
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.55), inset -1px -1px 1px rgba(156,170,169,0.45) !important;
  border-radius: 16px !important;
}
.scf-input {
  border: 1.5px solid #c6ccca !important;
  background: linear-gradient(180deg, #eef2f1, #d3dcdf) !important;
  border-radius: 10px !important;
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.5), inset -1px -1px 1px rgba(150,170,169,0.4) !important;
  color: #2a3a3e !important;
}
.scf-btn.primary {
  background: linear-gradient(90deg, #dde3df, #7fa0ab) !important;
  color: #0f1f22 !important;
  border: 1.5px solid #c6ccca !important;
  border-radius: 999px !important;
  box-shadow: -5px 0 8px rgba(255,255,255,0.35), 7px 0 12px rgba(2,29,37,0.22) !important;
}
.scf-btn.ghost {
  background: linear-gradient(90deg, #f0f4f3, #c5d0d4) !important;
  color: #3d6f82 !important;
  border: 1.5px solid #c6ccca !important;
  border-radius: 999px !important;
}
.scf-close {
  background: linear-gradient(90deg, #eef2f1, #b7c5ca) !important;
  border: 1.5px solid #c6ccca !important;
  border-radius: 50% !important;
  box-shadow: inset 1px 1px 2px rgba(255,255,255,0.5) !important;
  color: #2a3a3e !important;
}
.scf-badge {
  background: rgba(255,255,255,0.45) !important;
  border: 1px solid rgba(198,204,202,0.9) !important;
  color: #3d6f82 !important;
  border-radius: 999px !important;
}
.scf-table th {
  color: #6a7d83 !important;
}
</style>
