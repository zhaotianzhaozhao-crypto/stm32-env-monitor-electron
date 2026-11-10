<template>
  <div class="panel" :class="{ stretch }">
    <div class="panel-title">{{ title }}</div>
    <slot />
  </div>
</template>

<script setup>
/**
 * 侧栏面板薄容器（标题 + slot）；Mqtt/环境监测/设备控制/Skin 共用，勿当死代码删。
 */
defineProps({
  title: { type: String, required: true },
  /** 撑满侧栏剩余高度（设置页底部「关于」链用） */
  stretch: { type: Boolean, default: false },
});
</script>

<style scoped>
.panel.stretch {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
