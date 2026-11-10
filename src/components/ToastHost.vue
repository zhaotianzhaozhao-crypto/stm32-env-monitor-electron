<template>
  <div class="toast-host" aria-live="polite" aria-relevant="additions">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast-item"
        :class="t.tone"
      >
        <i class="toast-lamp" aria-hidden="true" />
        <span class="toast-text">{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
defineProps({
  toasts: { type: Array, default: () => [] },
});
</script>

<style scoped>
.toast-host {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: min(360px, calc(100vw - 36px));
}
.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--yz-metal-ink, #2a3a3e);
  background: linear-gradient(90deg, #eaefed, #95a7ae);
  border: 1.5px solid var(--yz-rim, #c6ccca);
  box-shadow:
    -6px 0 10px rgba(255, 255, 255, 0.35),
    10px 0 18px rgba(2, 29, 37, 0.22),
    inset 1px 1px 2px rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.toast-lamp {
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
  flex: none;
  background: var(--yz-accent, #5b8fa3);
  box-shadow: 0 0 5px rgba(91, 143, 163, 0.7);
}
.toast-text { flex: 1; min-width: 0; }
.toast-item.ok {
  color: #1b5c2e;
}
.toast-item.ok .toast-lamp {
  background: #dff7e6;
  box-shadow: 0 0 6px #fff, 0 0 10px rgba(120, 200, 140, 0.8);
}
.toast-item.bad {
  color: #7a1f1a;
}
.toast-item.bad .toast-lamp {
  background: #ffb4a8;
  box-shadow: 0 0 6px rgba(255, 140, 120, 0.85);
}
.toast-item.info .toast-lamp {
  background: #fff;
  box-shadow: 0 0 5px #fff, 0 0 8px rgba(227, 165, 96, 0.55);
}
.toast-item.warn {
  color: #6b4a12;
}
.toast-item.warn .toast-lamp {
  background: var(--yz-amber, #e3a560);
  box-shadow: 0 0 6px var(--yz-amber-glow, #f1b475);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
