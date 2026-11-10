<template>
  <Transition name="prog">
    <div v-if="visible" class="progress-overlay" :class="{ blocking }" role="status" aria-live="polite">
      <div class="progress-card">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: barWidth }" />
        </div>
        <div class="progress-text">{{ text || '处理中…' }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: Boolean,
  text: { type: String, default: '' },
  /** 0–100；不定长时用 indeterminate */
  percent: { type: Number, default: -1 },
  /** true 时挡住交互（连接握手）；下发指令用 false 不挡 */
  blocking: { type: Boolean, default: false },
});

const barWidth = computed(() => {
  const p = Number(props.percent);
  if (!Number.isFinite(p) || p < 0) return '35%';
  return `${Math.max(4, Math.min(100, p))}%`;
});
</script>

<style scoped>
.progress-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 9000;
  pointer-events: none;
  display: flex;
  justify-content: center;
  padding-top: 64px;
}
.progress-overlay.blocking {
  bottom: 0;
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(1px);
  align-items: flex-start;
}
.progress-card {
  min-width: 220px;
  max-width: 360px;
  padding: 10px 14px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
}
.progress-bar-track {
  height: 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #007aff, #34c759);
  transition: width 0.25s ease;
  animation: prog-pulse 1.2s ease-in-out infinite;
}
.progress-text {
  font-size: 12px;
  font-weight: 650;
  color: #3a3a3c;
  text-align: center;
}
.prog-enter-active,
.prog-leave-active {
  transition: opacity 0.2s ease;
}
.prog-enter-from,
.prog-leave-to {
  opacity: 0;
}
@keyframes prog-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
}
</style>
