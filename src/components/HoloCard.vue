<template>
  <div
    ref="rootEl"
    class="holo-card"
    :class="{ active: interacting }"
    role="img"
    :aria-label="name"
    @pointermove="onMove"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @pointerdown="onEnter"
  >
    <div class="holo-card-rotator" :style="rotatorStyle">
      <div class="holo-card-face">
        <img class="holo-card-img" :src="imageSrc" :alt="name" draggable="false" />
        <div class="holo-foil" aria-hidden="true" :style="foilStyle" />
        <div class="holo-glare" aria-hidden="true" :style="glareStyle" />
        <div class="holo-edge" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 精简 CSS 全息闪卡：指针驱动 3D tilt + 彩虹箔 / 高光。
 * 概念借鉴开源 CSS 全息卡探索，自行实现，未嵌入第三方源码。
 */
import { computed, reactive, ref } from 'vue';

const props = defineProps({
  imageSrc: { type: String, default: './about/default-card.webp' },
  name: { type: String, default: '默认闪卡' },
  /** 最大倾斜角度（度） */
  maxTilt: { type: Number, default: 14 },
});

const rootEl = ref(null);
const interacting = ref(false);
const ptr = reactive({ x: 0.5, y: 0.5 });

const onEnter = () => {
  interacting.value = true;
};

const onLeave = () => {
  interacting.value = false;
  ptr.x = 0.5;
  ptr.y = 0.5;
};

const onMove = (e) => {
  const el = rootEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  ptr.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  ptr.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
};

const rotatorStyle = computed(() => {
  const dx = ptr.x - 0.5;
  const dy = ptr.y - 0.5;
  const ry = dx * props.maxTilt * 2;
  const rx = -dy * props.maxTilt * 2;
  const boost = interacting.value ? 1 : 0.35;
  return {
    transform: `rotateX(${rx * boost}deg) rotateY(${ry * boost}deg)`,
  };
});

const foilStyle = computed(() => {
  const px = (ptr.x * 100).toFixed(2);
  const py = (ptr.y * 100).toFixed(2);
  const op = interacting.value ? 0.72 : 0.38;
  return {
    opacity: op,
    background: `
      radial-gradient(circle at ${px}% ${py}%,
        rgba(255,255,255,0.85) 0%,
        rgba(255,255,255,0.15) 18%,
        transparent 42%),
      linear-gradient(${(ptr.x * 120 + ptr.y * 40).toFixed(1)}deg,
        #ff0080 0%, #ff8c00 14%, #ffef00 28%, #00ff87 42%,
        #00cfff 56%, #7a5cff 72%, #ff0080 100%)
    `,
    backgroundSize: '100% 100%, 220% 220%',
    backgroundPosition: `0 0, ${px}% ${py}%`,
  };
});

const glareStyle = computed(() => {
  const px = (ptr.x * 100).toFixed(2);
  const py = (ptr.y * 100).toFixed(2);
  return {
    background: `radial-gradient(
      farthest-corner circle at ${px}% ${py}%,
      rgba(255,255,255,0.55) 0%,
      rgba(255,255,255,0.12) 25%,
      transparent 55%
    )`,
    opacity: interacting.value ? 0.9 : 0.45,
  };
});
</script>

<style scoped>
.holo-card {
  width: min(360px, 42vw);
  aspect-ratio: 0.716;
  perspective: 900px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.45));
}
.holo-card-rotator {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.12s ease-out;
  will-change: transform;
}
.holo-card.active .holo-card-rotator {
  transition: transform 0.06s linear;
}
.holo-card-face {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #1a1a1e;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  transform: translateZ(0);
}
.holo-card-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.holo-foil {
  position: absolute;
  inset: 0;
  mix-blend-mode: color-dodge;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.holo-glare {
  position: absolute;
  inset: 0;
  mix-blend-mode: soft-light;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.holo-edge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  pointer-events: none;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.22) 0%,
    transparent 28%,
    transparent 72%,
    rgba(255, 255, 255, 0.08) 100%
  );
  mix-blend-mode: screen;
  opacity: 0.55;
}
</style>
