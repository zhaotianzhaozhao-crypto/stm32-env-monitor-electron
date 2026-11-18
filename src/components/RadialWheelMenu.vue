<template>
  <div
    ref="rootEl"
    class="rw"
    :class="{ 'is-dragging': dragArmed, 'is-entered': entered }"
    role="listbox"
    :aria-label="ariaLabel"
    :aria-activedescendant="activeDesc"
    :tabindex="active ? 0 : -1"
    :data-wheel-count="items.length"
    :data-wheel-index="safeIndex"
    :data-wheel-entered="entered ? '1' : '0'"
    @keydown="onKey"
    @wheel.prevent.stop="onWheel"
  >
    <svg
      ref="svgEl"
      class="rw-svg"
      :viewBox="`0 0 ${WHEEL.size} ${WHEEL.size}`"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <defs>
        <radialGradient :id="`${uid}-bezel`" cx="50%" cy="38%" r="68%">
          <stop offset="0%" stop-color="#3c4654" />
          <stop offset="58%" stop-color="#1a212b" />
          <stop offset="100%" stop-color="#0c1016" />
        </radialGradient>
        <radialGradient :id="`${uid}-steel`" cx="50%" cy="50%" r="72%">
          <stop offset="62%" stop-color="#1a212b" />
          <stop offset="100%" stop-color="#2c3848" />
        </radialGradient>
        <radialGradient :id="`${uid}-steel-hot`" cx="50%" cy="50%" r="72%">
          <stop offset="62%" stop-color="#243041" />
          <stop offset="100%" stop-color="#3a4b60" />
        </radialGradient>
        <radialGradient
          :id="`${uid}-gold`"
          gradientUnits="userSpaceOnUse"
          cx="160"
          cy="160"
          r="150"
        >
          <stop offset="64%" stop-color="#a86b2d" />
          <stop offset="84%" stop-color="#e3a560" />
          <stop offset="100%" stop-color="#ffe3b5" />
        </radialGradient>
        <radialGradient
          :id="`${uid}-well`"
          gradientUnits="userSpaceOnUse"
          cx="160"
          cy="160"
          r="108"
        >
          <stop offset="72%" stop-color="rgba(0,0,0,0)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.55)" />
        </radialGradient>
        <filter :id="`${uid}-glow`" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.7" flood-color="#e3a560" flood-opacity="0.55" />
        </filter>
      </defs>

      <circle class="rw-bezel" :cx="WHEEL.cx" :cy="WHEEL.cy" :r="WHEEL.rBezel" :fill="`url(#${uid}-bezel)`" />
      <circle
        :cx="WHEEL.cx"
        :cy="WHEEL.cy"
        :r="WHEEL.rBezel"
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        stroke-width="1.2"
      />

      <g :transform="`rotate(${rotation} ${WHEEL.cx} ${WHEEL.cy})`">
        <path
          v-for="s in sectors"
          :key="s.id"
          :d="s.d"
          :fill="sectorFill(s)"
          :stroke="s.selected ? '#ffe7c2' : 'rgba(0,0,0,0.45)'"
          :stroke-width="s.selected ? 1.2 : 0.8"
          :filter="s.selected ? `url(#${uid}-glow)` : undefined"
        />
        <g v-for="s in sectors" :key="`${s.id}-pip`" :transform="placeAt(s.mid, WHEEL.rPip)">
          <circle r="3.1" :fill="pipFill(s)" />
        </g>
        <g v-for="s in sectors" :key="`${s.id}-lab`" :transform="placeAt(s.mid, WHEEL.rLabel)">
          <g :class="{ 'is-selected': s.selected }" :transform="`rotate(${-s.mid - rotation})`">
            <text class="rw-lab-idx" text-anchor="middle" y="-8">{{ pad(s.i) }}</text>
            <text class="rw-lab" text-anchor="middle" y="7" :font-size="nameSize">{{ s.sectorText }}</text>
          </g>
        </g>
      </g>

      <g class="rw-ticks">
        <line
          v-for="t in ticks"
          :key="t.deg"
          :x1="t.x1"
          :y1="t.y1"
          :x2="t.x2"
          :y2="t.y2"
          :stroke="t.major ? '#e7d3b0' : t.mid ? '#9aa6b2' : '#5d6874'"
          :stroke-width="t.major ? 1.7 : t.mid ? 1.05 : 0.7"
          stroke-linecap="round"
        />
      </g>
      <circle
        :cx="WHEEL.cx"
        :cy="WHEEL.cy"
        r="108"
        :fill="`url(#${uid}-well)`"
      />

      <g class="rw-cursor">
        <polygon points="147,3 173,3 160,19" fill="#c4843a" />
        <polygon points="151,5 169,5 160,16" fill="#fff1d6" />
      </g>

      <rect class="rw-hit" x="0" y="0" :width="WHEEL.size" :height="WHEEL.size" fill="transparent" />
    </svg>

    <div
      v-if="current"
      class="rw-hud"
      :data-mode="entered ? 'entered' : 'preview'"
      :role="entered ? 'group' : 'button'"
      :aria-label="hudAria"
      @click="onHudClick"
    >
      <div :key="current.id" class="rw-copy">
        <div class="rw-index">{{ indexLabel }}</div>
        <div class="rw-title">{{ current.short }}</div>
        <div v-if="!entered" class="rw-sub">{{ current.subtitle }}</div>
        <div class="rw-param" :class="{ on: current.on }">{{ current.param }}</div>
        <div v-if="!entered" class="rw-cue">进入</div>
        <div v-if="entered && current.command" class="rw-cmd">{{ current.command }}</div>
      </div>
      <div
        v-if="entered"
        class="rw-switch"
        :class="{ on: current.on, disabled: !canToggle }"
        role="switch"
        :aria-checked="current.on ? 'true' : 'false'"
        :aria-disabled="canToggle ? 'false' : 'true'"
        :tabindex="canToggle ? 0 : -1"
        :title="toggleTitle"
        @click.stop="onToggle"
        @keydown.enter.prevent.stop="onToggle"
        @keydown.space.prevent.stop="onToggle"
      >
        <span class="rw-switch-track"><span class="rw-switch-knob" /></span>
        <span class="rw-switch-text">{{ current.on ? '开' : '关' }}</span>
      </div>
      <button v-if="entered" type="button" class="rw-back" @click.stop="emit('leave')">返回</button>
    </div>

    <div class="sr-only">
      <button
        v-for="(item, i) in items"
        :id="optionId(i)"
        :key="item.id"
        type="button"
        role="option"
        :aria-selected="i === safeIndex ? 'true' : 'false'"
        tabindex="-1"
        @click="onOption(i)"
      >{{ item.short }}</button>
    </div>
  </div>
</template>

<script setup>
/**
 * 设备控制径向轮盘。
 * 圆盘旋转，使选中扇区中心对齐 12 点三角游标；选中块为暖金并略向外凸起。
 * 滚轮 / 拖转 / 方向键只改预览；点击当前扇区或中心进入，开/关仍由父级下发。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import gsap from 'gsap';
import {
  WHEEL,
  annularSectorPath,
  clockDegFromPoint,
  indexFromRotation,
  normalize180,
  normalize360,
  rotationForIndex,
  sectorAngles,
  sectorIndexAtVisual,
  tickMarks,
} from '../utils/radialWheel.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
  entered: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  canToggle: { type: Boolean, default: false },
  toggleTitle: { type: String, default: '' },
});

const emit = defineEmits(['select', 'step', 'enter', 'leave', 'toggle']);

const uid = `rw${Math.random().toString(36).slice(2, 8)}`;
const rootEl = ref(null);
const svgEl = ref(null);
const rotation = ref(0);
const dragArmed = ref(false);
const hoverIndex = ref(-1);
const spin = { deg: 0 };
const ticks = tickMarks();

let tracking = false;
let moved = false;
let pointerId = -1;
let lastAng = 0;
let originX = 0;
let originY = 0;
let wheelAcc = 0;

const count = computed(() => props.items.length);
const safeIndex = computed(() => {
  const n = count.value;
  if (!n) return 0;
  const i = Number(props.index) || 0;
  return ((i % n) + n) % n;
});
const current = computed(() => props.items[safeIndex.value] || null);

const nameSize = computed(() => {
  const n = count.value;
  if (n >= 8) return 9;
  if (n >= 6) return 10;
  return 12;
});

const sectors = computed(() => {
  const n = count.value;
  if (!n) return [];
  return props.items.map((item, i) => {
    const ang = sectorAngles(i, n);
    const selected = i === safeIndex.value;
    const rOut = selected ? WHEEL.rSectorSel : WHEEL.rSectorOut;
    return {
      ...item,
      i,
      selected,
      mid: ang.mid,
      d: annularSectorPath(WHEEL.cx, WHEEL.cy, WHEEL.rSectorIn, rOut, ang.a0, ang.a1),
    };
  });
});

const indexLabel = computed(() => {
  const n = count.value;
  if (!n) return '00/00';
  return `${pad(safeIndex.value)}/${String(n).padStart(2, '0')}`;
});

const ariaLabel = computed(() => {
  const c = current.value;
  if (!c) return '设备轮盘';
  return `设备轮盘，当前 ${c.short}，${indexLabel.value}。左右方向键切换，回车进入。`;
});

const hudAria = computed(() => {
  const c = current.value;
  if (!c) return '设备预览';
  if (props.entered) return `${c.short}，${c.param}。返回可回到轮盘。`;
  return `${c.short}，${c.subtitle}，${c.param}。点击进入。`;
});

const activeDesc = computed(() => optionId(safeIndex.value));

function pad(i) {
  return String(i + 1).padStart(2, '0');
}
function optionId(i) {
  return `${uid}-opt-${i}`;
}
function placeAt(mid, r) {
  return `translate(${WHEEL.cx} ${WHEEL.cy}) rotate(${mid}) translate(0 ${-r})`;
}
function sectorFill(s) {
  if (s.selected) return `url(#${uid}-gold)`;
  if (s.i === hoverIndex.value) return `url(#${uid}-steel-hot)`;
  return `url(#${uid}-steel)`;
}
function pipFill(s) {
  if (!s.on) return s.selected ? 'rgba(42,33,22,0.38)' : '#3a4452';
  return s.selected ? '#1f7a38' : '#3ddc84';
}

function reducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function applyRotation(deg) {
  spin.deg = deg;
  rotation.value = deg;
}

function spinTo(i, len, immediate = false) {
  const n = Math.max(len || 0, 1);
  const idx = ((i % n) + n) % n;
  const target = rotationForIndex(idx, n, spin.deg);
  gsap.killTweensOf(spin);
  if (immediate || reducedMotion() || Math.abs(target - spin.deg) < 0.05) {
    applyRotation(target);
    return;
  }
  gsap.to(spin, {
    deg: target,
    duration: 0.46,
    ease: 'power3.out',
    onUpdate: () => {
      rotation.value = spin.deg;
    },
  });
}

watch(
  () => [props.index, props.items.length],
  ([i, len], prev) => {
    if (!len || dragArmed.value) return;
    spinTo(i, len, !prev);
  },
  { immediate: true },
);

function toLocal(e) {
  const svg = svgEl.value;
  if (!svg) return { x: WHEEL.cx, y: WHEEL.cy };
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: WHEEL.cx, y: WHEEL.cy };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function hitTest(p) {
  const n = count.value;
  if (!n) return { zone: 'outside', index: -1 };
  const dist = Math.hypot(p.x - WHEEL.cx, p.y - WHEEL.cy);
  if (dist <= WHEEL.rHud + 1) return { zone: 'center', index: -1 };
  if (dist >= WHEEL.rSectorIn - 8 && dist <= WHEEL.rBezel + 4) {
    const ang = clockDegFromPoint(p.x, p.y, WHEEL.cx, WHEEL.cy);
    return {
      zone: 'sector',
      index: sectorIndexAtVisual(normalize360(ang), spin.deg, n),
    };
  }
  return { zone: 'outside', index: -1 };
}

function endDragListeners() {
  window.removeEventListener('pointermove', onWindowMove);
  window.removeEventListener('pointerup', onWindowUp);
  window.removeEventListener('pointercancel', onWindowUp);
}

function onWindowMove(e) {
  if (!tracking || e.pointerId !== pointerId) return;
  const p = toLocal(e);
  if (!moved) {
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    if (dx * dx + dy * dy < 16) return;
    moved = true;
    dragArmed.value = true;
  }
  const ang = clockDegFromPoint(p.x, p.y, WHEEL.cx, WHEEL.cy);
  const delta = normalize180(ang - lastAng);
  lastAng = ang;
  spin.deg += delta;
  rotation.value = spin.deg;
  const n = count.value;
  if (!n) return;
  const i = indexFromRotation(spin.deg, n);
  if (i !== safeIndex.value) emit('select', i);
}

function onWindowUp(e) {
  if (!tracking || e.pointerId !== pointerId) return;
  endDragListeners();
  finishPointer(e);
  try { svgEl.value?.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
}

function onPointerDown(e) {
  if (!props.active) return;
  if (e.button !== undefined && e.button !== 0) return;
  endDragListeners();
  const p = toLocal(e);
  const hit = hitTest(p);
  if (hit.zone !== 'sector') return;
  tracking = true;
  moved = false;
  pointerId = e.pointerId;
  lastAng = clockDegFromPoint(p.x, p.y, WHEEL.cx, WHEEL.cy);
  originX = e.clientX;
  originY = e.clientY;
  gsap.killTweensOf(spin);
  e.preventDefault();
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowUp);
  try { svgEl.value?.setPointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
}

function onPointerMove(e) {
  if (tracking) return;
  const hit = hitTest(toLocal(e));
  hoverIndex.value = hit.zone === 'sector' ? hit.index : -1;
}

function finishPointer(e) {
  if (!tracking || (e && e.pointerId !== undefined && e.pointerId !== pointerId && pointerId !== -1)) return;
  const wasDrag = moved;
  tracking = false;
  moved = false;
  pointerId = -1;
  const n = count.value;
  if (wasDrag) {
    const i = n ? indexFromRotation(spin.deg, n) : 0;
    if (n && i !== safeIndex.value) emit('select', i);
    dragArmed.value = false;
    if (n) spinTo(i, n, false);
    return;
  }
  dragArmed.value = false;
  if (!n) return;
  const hit = e ? hitTest(toLocal(e)) : { zone: 'outside', index: -1 };
  if (hit.zone === 'sector' && hit.index !== safeIndex.value) {
    emit('select', hit.index);
    return;
  }
  if (hit.zone === 'sector') emit('enter');
  // 按下时停过补间；点按或松手在环外时，把当前扇区转回 12 点
  spinTo(safeIndex.value, n, false);
}

function onPointerUp(e) {
  if (!tracking) return;
  endDragListeners();
  finishPointer(e);
  try { svgEl.value?.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
}

function onPointerLeave() {
  if (!tracking) hoverIndex.value = -1;
}

function onHudClick() {
  if (!props.active || props.entered) return;
  emit('enter');
}

function onToggle() {
  if (!props.active || !props.canToggle) return;
  emit('toggle');
}

function onOption(i) {
  if (i === safeIndex.value) emit('enter');
  else emit('select', i);
}

function onWheel(e) {
  if (!props.active || !count.value) return;
  const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 40 : 1;
  const dy = raw * scale;
  // 鼠标一格通常 ≥ 40；触控板的小增量攒够再走一扇区，避免一滑跳很多格
  if (Math.abs(dy) >= 40) {
    wheelAcc = 0;
    emit('step', dy > 0 ? 1 : -1);
    return;
  }
  wheelAcc += dy;
  if (Math.abs(wheelAcc) < 40) return;
  const dir = wheelAcc > 0 ? 1 : -1;
  wheelAcc = 0;
  emit('step', dir);
}

function onKey(e) {
  if (!props.active) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('leave');
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    emit('step', 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    emit('step', -1);
  } else if ((e.key === 'Enter' || e.key === ' ') && !props.entered) {
    if (e.target?.closest?.('.rw-switch, .rw-back')) return;
    e.preventDefault();
    emit('enter');
  }
}

function blurWheel() {
  rootEl.value?.blur?.();
}

defineExpose({ blurWheel });

onBeforeUnmount(() => {
  endDragListeners();
  gsap.killTweensOf(spin);
});
</script>

<style scoped>
.rw {
  position: relative;
  width: min(100%, 304px);
  margin: 2px auto 0;
  user-select: none;
  touch-action: none;
  outline: none;
  border-radius: 50%;
}
.rw:focus-visible {
  outline: 2px solid rgba(227, 165, 96, 0.9);
  outline-offset: 3px;
}
.rw-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  cursor: grab;
  filter: drop-shadow(0 12px 16px rgba(2, 29, 37, 0.28));
}
.rw.is-dragging .rw-svg { cursor: grabbing; }
.rw-svg * { pointer-events: none; }
.rw-hit { pointer-events: all; }

.rw-lab-idx {
  fill: #8b98a5;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  font-family: var(--mono);
}
.rw-lab {
  fill: #e6edf3;
  font-weight: 750;
  font-family: var(--font);
}
.is-selected .rw-lab-idx { fill: #6b4a1e; }
.is-selected .rw-lab { fill: #2a2116; }

.rw-hud {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 55%;
  height: 55%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  box-sizing: border-box;
  padding: 10px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-align: center;
  color: #f6f3ee;
  cursor: pointer;
  background:
    radial-gradient(circle at 50% 36%, #343e4c 0%, #1a212b 64%, #10151b 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.07),
    inset 0 -14px 18px rgba(0, 0, 0, 0.28),
    0 10px 18px rgba(0, 0, 0, 0.38);
  z-index: 2;
}
.rw.is-entered .rw-hud {
  cursor: default;
  box-shadow:
    inset 0 0 0 1.5px rgba(227, 165, 96, 0.7),
    inset 0 -14px 18px rgba(0, 0, 0, 0.28),
    0 0 16px rgba(227, 165, 96, 0.22);
}
.rw-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 86%;
  min-width: 0;
  animation: rw-in 0.22s ease;
}
.rw-index {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #e3a560;
}
.rw-title {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 750;
  line-height: 1.15;
  letter-spacing: 0.04em;
}
.rw.is-entered .rw-title { font-size: 16px; }
.rw-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #93a0ae;
}
.rw-param {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.03em;
  color: #f0d7b0;
}
.rw-param.on { color: #d7f5c8; }
.rw-cue {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.22em;
  color: rgba(227, 165, 96, 0.92);
}
.rw-cmd {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono);
  font-size: 9px;
  color: #8e9bab;
}
.rw-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  margin-top: 2px;
  padding: 0 8px 0 4px;
  border-radius: 999px;
  border: 1px solid rgba(227, 165, 96, 0.45);
  background: linear-gradient(180deg, #2c3542, #171c24);
  color: #f4efe6;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
}
.rw-switch.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.rw-switch-track {
  position: relative;
  width: 32px;
  height: 16px;
  border-radius: 999px;
  background: #3a4452;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
}
.rw-switch.on .rw-switch-track {
  background: linear-gradient(180deg, #3d9a5a, #34c759);
}
.rw-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(180deg, #fff, #d5dde4);
  transition: transform 0.2s cubic-bezier(0.22, 0.82, 0.24, 1);
}
.rw-switch.on .rw-switch-knob { transform: translateX(16px); }
.rw-switch-text {
  font-size: 12px;
  font-weight: 750;
  min-width: 1em;
}
.rw-back {
  border: none;
  background: transparent;
  color: #c9b28a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  line-height: 1;
  padding: 3px 10px;
  border-radius: 999px;
}
.rw-back:hover { color: #ffe7c2; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes rw-in {
  from { opacity: 0.35; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .rw-copy { animation: none; }
  .rw-switch-knob { transition: none; }
}
</style>
