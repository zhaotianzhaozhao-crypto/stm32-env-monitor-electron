<template>
  <Teleport to="body">
    <Transition name="wheel-osd">
      <div
        v-if="show"
        class="wheel-osd"
        role="status"
        aria-live="polite"
        aria-label="请使用滚轮"
      >
        <div class="wheel-osd-card">
          <svg class="wheel-osd-svg" viewBox="0 0 96 96" aria-hidden="true">
            <rect x="30" y="8" width="36" height="80" rx="18" fill="none" stroke="currentColor" stroke-width="3.5" />
            <rect class="wheel-osd-scroll" x="42" y="26" width="12" height="22" rx="6" fill="currentColor" />
            <path d="M48 18 v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.45" />
            <path d="M48 72 v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.45" />
          </svg>
          <span class="wheel-osd-caption">请使用滚轮</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
});
</script>

<style>
.wheel-osd {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.wheel-osd-card {
  width: 120px;
  height: 120px;
  border-radius: 24px;
  background: rgba(48, 50, 56, 0.62);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  color: rgba(250, 250, 252, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.wheel-osd-svg {
  width: 58px;
  height: 58px;
}
.wheel-osd-scroll {
  transform-origin: 48px 37px;
  animation: wheel-osd-nudge 0.7s ease-in-out infinite;
}
.wheel-osd-caption {
  font-size: 12px;
  letter-spacing: 0.06em;
  opacity: 0.92;
  font-weight: 650;
}
@keyframes wheel-osd-nudge {
  0%, 100% { transform: translateY(-4px); }
  50% { transform: translateY(6px); }
}
.wheel-osd-enter-active,
.wheel-osd-leave-active {
  transition: opacity 0.12s ease;
}
.wheel-osd-enter-active .wheel-osd-card,
.wheel-osd-leave-active .wheel-osd-card {
  transition: transform 0.12s ease, opacity 0.12s ease;
}
.wheel-osd-enter-from,
.wheel-osd-leave-to {
  opacity: 0;
}
.wheel-osd-enter-from .wheel-osd-card,
.wheel-osd-leave-to .wheel-osd-card {
  transform: scale(0.9);
  opacity: 0;
}
</style>
