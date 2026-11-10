/**
 * 滚轮操作 OSD：「请使用滚轮」半透明提示，默认显示 0.5s
 */
import { ref, onBeforeUnmount } from 'vue';

export function useWheelOsd(durationMs = 500) {
  const showWheelOsd = ref(false);
  let timer = 0;

  function pulseWheelOsd() {
    showWheelOsd.value = true;
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      showWheelOsd.value = false;
      timer = 0;
    }, durationMs);
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  return { showWheelOsd, pulseWheelOsd };
}
