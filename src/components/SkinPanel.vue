<template>
  <SidebarPanel title="界面皮肤">
    <!-- 横向轮播；主预览=MyUI 迷你屏（SCREEN_SKINS）→ v-model → 孪生屏同色板 -->
    <div
      class="collect-orbit skin-orbit"
      role="listbox"
      aria-label="界面皮肤流水线切换"
      tabindex="0"
      @wheel.prevent="onWheel"
      @click="onSkinClick"
      @keydown.left.prevent="stepDeck(-1)"
      @keydown.right.prevent="stepDeck(1)"
      @keydown.up.prevent="stepDeck(-1)"
      @keydown.down.prevent="stepDeck(1)"
    >

      <div class="orbit-viewport">
        <div class="orbit-track">
          <div
            v-for="(s, i) in skinsList"
            :key="s.id"
            class="orbit-slot"
            :class="slotClass(i)"
            :style="slotStyle(i)"
            role="option"
            :aria-selected="i === deckIndex"
            @click.stop="i === deckIndex ? onSkinClick() : goDeck(i)"
          >
            <button
              type="button"
              class="skin-face"
              :class="{ active: i === deckIndex }"
              :title="`${s.name} → 模型屏 ${s.id}`"
            >
              <!-- 迷你硬件屏：布局对齐 MyUI / Three drawScreen -->
              <span class="lvgl-screen" :style="screenShellStyle(s.id)" aria-hidden="true">
                <span class="lvgl-glow" :style="glowStyle(s.id)" />
                <span class="lvgl-bar" :style="{ background: pal(s.id).BAR_BG }">
                  <span class="lvgl-time" :style="{ color: pal(s.id).TEXT, fontWeight: pal(s.id).FONT_WEIGHT }">{{ clock.hm }}</span>
                  <span class="lvgl-date" :style="{ color: pal(s.id).TEXT_DIM }">{{ clock.md }}</span>
                  <span class="lvgl-wifi">
                    <i
                      v-for="n in 4"
                      :key="n"
                      :style="{
                        height: (3 + n * 2) + 'px',
                        background: n <= 3 ? pal(s.id).WIFI_ON : pal(s.id).WIFI_OFF,
                      }"
                    />
                  </span>
                  <span class="lvgl-batt" :style="{ color: pal(s.id).TEXT_DIM }">▮ 86%</span>
                </span>
                <span class="lvgl-main">
                  <span class="lvgl-left">
                    <span class="lvgl-temp-row">
                      <span class="lvgl-temp" :style="{ color: pal(s.id).TEMP, fontWeight: pal(s.id).FONT_WEIGHT }">26</span>
                      <span class="lvgl-unit" :style="{ color: pal(s.id).TEXT_DIM }">°C</span>
                    </span>
                    <span class="lvgl-rule" :style="{ background: pal(s.id).HAIRLINE || pal(s.id).DIV }" />
                    <span class="lvgl-row">
                      <span class="lvgl-lbl" :style="{ color: pal(s.id).TEXT_DIM }">天气</span>
                      <span class="lvgl-val" :style="{ color: pal(s.id).WEATHER, fontWeight: pal(s.id).FONT_WEIGHT }">18~28°</span>
                    </span>
                    <span class="lvgl-rule" :style="{ background: pal(s.id).HAIRLINE || pal(s.id).DIV }" />
                    <span class="lvgl-row">
                      <span class="lvgl-lbl" :style="{ color: pal(s.id).TEXT_DIM }">湿度</span>
                      <span class="lvgl-val" :style="{ color: pal(s.id).HUMI, fontWeight: pal(s.id).FONT_WEIGHT }">55%</span>
                    </span>
                  </span>
                  <span class="lvgl-right">
                    <span class="lvgl-air-cap" :style="{ color: pal(s.id).AIR_DIM || pal(s.id).TEXT_DIM }">空气质量</span>
                    <span class="lvgl-aqi" :style="{ color: pal(s.id).AIR, fontWeight: pal(s.id).FONT_WEIGHT }">42</span>
                    <span class="lvgl-level" :style="{ color: pal(s.id).AIR }">优</span>
                  </span>
                </span>
                <span class="lvgl-segs">
                  <i
                    v-for="n in 12"
                    :key="'seg' + n"
                    :style="{ background: n <= 4 ? pal(s.id).AIR : (pal(s.id).HAIRLINE || '#262E37') }"
                  />
                </span>
              </span>
              <span class="skin-face-name">{{ s.name }}</span>
            </button>
          </div>
        </div>
      </div>

    </div>
    <WheelOsd :show="showWheelOsd" />
  </SidebarPanel>
</template>

<script setup>
/**
 * 界面皮肤 — 横向卡槽 + MyUI 迷你屏预览（色板同源 SCREEN_SKINS）
 * v-model → App.applyScreenSkin → Three.setScreenSkin + MQTT skin:<id>
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SidebarPanel from './SidebarPanel.vue';
import WheelOsd from './WheelOsd.vue';
import { useWheelOsd } from '../composables/useWheelOsd.js';
import { SKINS } from '../config.js';
import { SCREEN_SKINS } from '../three/screenTheme.js';

const VISIBLE_SPAN = 2;
const SLOT_X = 82;
const SLOT_Z = 30;
const SLOT_Y = 8;
const SLOT_RY = 26;

const props = defineProps({
  modelValue: { type: String, default: 'industrial-dark' },
  skins: { type: Array, default: () => SKINS },
});
const emit = defineEmits(['update:modelValue']);
const { showWheelOsd, pulseWheelOsd } = useWheelOsd(500);

const skinsList = computed(() => (props.skins?.length ? props.skins : SKINS));
const skinCount = computed(() => Math.max(skinsList.value.length, 1));
const deckIndex = ref(0);

const clock = ref({ hm: '12:00', md: '11/3' });
let clockTimer = 0;
const tickClock = () => {
  const now = new Date();
  clock.value = {
    hm: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    md: `${now.getMonth() + 1}/${now.getDate()}`,
  };
};
onMounted(() => {
  tickClock();
  clockTimer = window.setInterval(tickClock, 30000);
});
onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer);
});

const currentName = computed(() => {
  const hit = skinsList.value.find((s) => s.id === props.modelValue);
  return hit?.name || props.modelValue;
});

const pal = (id) => SCREEN_SKINS[id] || SCREEN_SKINS['industrial-dark'];

const screenShellStyle = (id) => {
  const p = pal(id);
  return {
    background: p.SCREEN_BG,
    borderColor: p.ACCENT,
    boxShadow: `inset 0 0 0 1px ${p.HAIRLINE || 'rgba(255,255,255,0.08)'}, 0 0 12px ${p.ACCENT}40`,
  };
};

const glowStyle = (id) => {
  const p = pal(id);
  return {
    background: `radial-gradient(ellipse at 72% 55%, ${p.GLOW_GOOD}66, transparent 70%)`,
  };
};

const emitSkinByIndex = (i) => {
  const s = skinsList.value[i];
  if (!s) return;
  if (s.id !== props.modelValue) emit('update:modelValue', s.id);
};

const relOffset = (i) => {
  const n = skinCount.value;
  if (n <= 0) return 0;
  let d = i - deckIndex.value;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
};

const slotClass = (i) => {
  const d = relOffset(i);
  const abs = Math.abs(d);
  return {
    'is-active': d === 0,
    'is-near': abs === 1,
    'is-far': abs === 2,
    'is-hidden': abs > VISIBLE_SPAN,
  };
};

const slotStyle = (i) => {
  const d = relOffset(i);
  const abs = Math.abs(d);
  if (abs > VISIBLE_SPAN) {
    return {
      opacity: 0,
      pointerEvents: 'none',
      zIndex: 0,
      transform: `translate3d(${d * SLOT_X * 1.15}px, ${Math.abs(d) * SLOT_Y}px, ${-abs * SLOT_Z - 36}px) rotateY(${-d * SLOT_RY}deg) scale(0.74)`,
    };
  }
  const scale = d === 0 ? 1 : abs === 1 ? 0.86 : 0.74;
  const opacity = d === 0 ? 1 : abs === 1 ? 0.78 : 0.42;
  return {
    opacity,
    zIndex: 20 - abs,
    transform: `translate3d(${d * SLOT_X}px, ${abs * SLOT_Y}px, ${-abs * SLOT_Z}px) rotateY(${-d * SLOT_RY}deg) scale(${scale})`,
    pointerEvents: abs <= 1 ? 'auto' : 'none',
  };
};

let wheelLock = 0;
const stepDeck = (dir) => {
  const n = skinCount.value;
  if (n <= 1) return;
  const step = dir < 0 ? -1 : 1;
  const next = (deckIndex.value + step + n) % n;
  deckIndex.value = next;
  emitSkinByIndex(next);
  pulseWheelOsd();
};

const goDeck = (i) => {
  const n = skinCount.value;
  if (i < 0 || i >= n) return;
  if (i === deckIndex.value) {
    emitSkinByIndex(i);
    return;
  }
  deckIndex.value = i;
  emitSkinByIndex(i);
};

const onSkinClick = () => {
  pulseWheelOsd();
};

const onWheel = (e) => {
  const now = Date.now();
  if (now - wheelLock < 220) return;
  wheelLock = now;
  const dy = e.deltaY || 0;
  const dx = e.deltaX || 0;
  const primary = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
  if (!primary) return;
  pulseWheelOsd();
  stepDeck(primary > 0 ? 1 : -1);
};

watch(
  () => props.modelValue,
  (id) => {
    const i = skinsList.value.findIndex((s) => s.id === id);
    if (i < 0) return;
    if (deckIndex.value !== i) deckIndex.value = i;
  },
  { immediate: true },
);

watch(skinCount, (n) => {
  if (deckIndex.value >= n) deckIndex.value = Math.max(0, n - 1);
});
</script>

<style scoped>
.collect-orbit {
  position: relative;
  margin-top: 2px;
  padding: 14px 10px 10px;
  border-radius: 22px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(145deg, rgba(234, 239, 237, 0.96), rgba(149, 167, 174, 0.42));
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.55), 0 8px 16px rgba(2, 29, 37, 0.12);
  outline: none;
  user-select: none;
}
.collect-orbit:focus-visible {
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    0 8px 16px rgba(2, 29, 37, 0.12),
    0 0 0 2px rgba(227, 165, 96, 0.55);
}
.orbit-viewport {
  position: relative;
  z-index: 1;
  height: 178px;
  perspective: 920px;
  perspective-origin: 50% 42%;
  overflow: visible;
}
.orbit-track {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}
.orbit-slot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(188px, 84%);
  height: 158px;
  margin-left: calc(min(188px, 84%) / -2);
  margin-top: -79px;
  transform-style: preserve-3d;
  transition: transform 0.42s cubic-bezier(0.22, 0.82, 0.24, 1), opacity 0.36s ease;
  will-change: transform, opacity;
}
.orbit-slot.is-active {
  filter: drop-shadow(8px 0 14px rgba(2, 29, 37, 0.22));
}
.skin-face {
  width: 100%;
  height: 158px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  padding: 8px 8px 6px;
  border-radius: 18px;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(145deg, rgba(234, 239, 237, 0.98), rgba(149, 167, 174, 0.55));
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), 8px 0 14px rgba(2, 29, 37, 0.12);
  color: #2a3a3e;
  cursor: pointer;
}
.skin-face.active {
  border-color: rgba(227, 165, 96, 0.92);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    0 0 0 1px rgba(227, 165, 96, 0.4),
    0 0 16px rgba(227, 165, 96, 0.3),
    8px 0 14px rgba(2, 29, 37, 0.16);
}

/* —— MyUI 迷你屏 —— */
.lvgl-screen {
  position: relative;
  width: 100%;
  height: 112px;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: none;
  text-align: left;
}
.lvgl-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.85;
}
.lvgl-bar {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 4px;
  padding: 3px 5px 2px;
  min-height: 18px;
}
.lvgl-time {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.02em;
}
.lvgl-date {
  font-size: 8px;
  line-height: 1;
  margin-top: 1px;
}
.lvgl-wifi {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 1.5px;
  height: 10px;
}
.lvgl-wifi i {
  display: block;
  width: 2px;
  border-radius: 1px;
}
.lvgl-batt {
  font-size: 7px;
  font-weight: 650;
  justify-self: end;
}
.lvgl-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  grid-template-columns: 1.35fr 0.9fr;
  gap: 4px;
  padding: 2px 5px 0;
  min-height: 0;
}
.lvgl-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.lvgl-temp-row {
  display: flex;
  align-items: flex-start;
  gap: 1px;
  line-height: 1;
}
.lvgl-temp {
  font-size: 26px;
  letter-spacing: -0.02em;
}
.lvgl-unit {
  font-size: 8px;
  margin-top: 10px;
}
.lvgl-rule {
  display: block;
  height: 1px;
  width: 92%;
  opacity: 0.9;
  margin: 1px 0;
}
.lvgl-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.lvgl-lbl {
  font-size: 7px;
  font-weight: 600;
}
.lvgl-val {
  font-size: 9px;
}
.lvgl-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 2px;
  min-width: 0;
}
.lvgl-air-cap {
  font-size: 7px;
  font-weight: 600;
}
.lvgl-aqi {
  font-size: 22px;
  line-height: 1;
  margin-top: 2px;
}
.lvgl-level {
  font-size: 8px;
  font-weight: 700;
  margin-top: 2px;
}
.lvgl-segs {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 5px 4px;
}
.lvgl-segs i {
  display: block;
  width: 5px;
  height: 2px;
  border-radius: 1px;
  flex: 1;
  max-width: 8px;
}

.skin-face-name {
  font-size: 12px;
  font-weight: 750;
  color: #2a3a3e;
}
</style>
