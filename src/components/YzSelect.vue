<template>
  <div
    ref="rootEl"
    class="yz-select"
    :class="{ open, disabled }"
  >
    <button
      ref="triggerEl"
      type="button"
      class="yz-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <span class="yz-select-value" :class="{ placeholder: !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
      <span class="yz-select-chevron" aria-hidden="true">▾</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="yz-select-menu"
        role="listbox"
        tabindex="-1"
        :style="menuStyle"
        @keydown="onMenuKey"
      >
        <button
          v-for="(opt, i) in normalized"
          :key="String(opt.value) + '-' + i"
          type="button"
          class="yz-select-option"
          role="option"
          :aria-selected="isSelected(opt)"
          :disabled="opt.disabled"
          :class="{
            active: isSelected(opt),
            highlight: i === highlightIndex,
            disabled: opt.disabled,
          }"
          @click="choose(opt)"
          @mouseenter="highlightIndex = i"
        >
          <i class="yz-opt-lamp" aria-hidden="true" />
          <span class="yz-opt-label">{{ opt.label }}</span>
        </button>
        <div v-if="!normalized.length" class="yz-select-empty">无选项</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * YZRT 自绘下拉：避免原生 select 系统蓝列表。
 * v-model 兼容；options: { value, label, disabled? }[]
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const rootEl = ref(null);
const triggerEl = ref(null);
const menuEl = ref(null);
const open = ref(false);
const highlightIndex = ref(0);
const menuStyle = ref({});

const normalized = computed(() =>
  (props.options || []).map((o) => {
    if (o == null) return { value: '', label: '', disabled: true };
    if (typeof o === 'string' || typeof o === 'number') {
      return { value: o, label: String(o), disabled: false };
    }
    return {
      value: o.value ?? o.id ?? '',
      label: o.label ?? o.name ?? String(o.value ?? o.id ?? ''),
      disabled: !!o.disabled,
    };
  }),
);

const selectedLabel = computed(() => {
  const hit = normalized.value.find((o) => String(o.value) === String(props.modelValue));
  return hit?.label || '';
});

function isSelected(opt) {
  return String(opt.value) === String(props.modelValue);
}

function enabledIndexes() {
  return normalized.value
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);
}

function placeMenu() {
  const el = triggerEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(r.width, 160);
  let left = r.left;
  if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
  const below = vh - r.bottom;
  const openUp = below < 220 && r.top > below;
  const maxH = Math.min(240, openUp ? r.top - 12 : below - 12);
  menuStyle.value = {
    position: 'fixed',
    zIndex: 10050,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(Math.max(120, maxH))}px`,
    ...(openUp
      ? { bottom: `${Math.round(vh - r.top + 6)}px`, top: 'auto' }
      : { top: `${Math.round(r.bottom + 6)}px`, bottom: 'auto' }),
  };
}

function syncHighlight() {
  const idx = normalized.value.findIndex((o) => isSelected(o) && !o.disabled);
  const ens = enabledIndexes();
  highlightIndex.value = idx >= 0 ? idx : ens[0] ?? 0;
}

async function openMenu() {
  if (props.disabled) return;
  open.value = true;
  syncHighlight();
  await nextTick();
  placeMenu();
  menuEl.value?.focus?.();
}

function closeMenu() {
  open.value = false;
}

function toggle() {
  if (open.value) closeMenu();
  else openMenu();
}

function choose(opt) {
  if (!opt || opt.disabled) return;
  const v = opt.value;
  emit('update:modelValue', v);
  emit('change', v);
  closeMenu();
  triggerEl.value?.focus?.();
}

function moveHighlight(dir) {
  const ens = enabledIndexes();
  if (!ens.length) return;
  let pos = ens.indexOf(highlightIndex.value);
  if (pos < 0) pos = dir > 0 ? -1 : 0;
  pos = (pos + dir + ens.length) % ens.length;
  highlightIndex.value = ens[pos];
  nextTick(() => {
    const btn = menuEl.value?.querySelectorAll?.('.yz-select-option')?.[highlightIndex.value];
    btn?.scrollIntoView?.({ block: 'nearest' });
  });
}

function onTriggerKey(e) {
  if (props.disabled) return;
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!open.value) openMenu();
    else if (e.key === 'ArrowDown') moveHighlight(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!open.value) openMenu();
    else moveHighlight(-1);
  } else if (e.key === 'Escape') {
    closeMenu();
  }
}

function onMenuKey(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveHighlight(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveHighlight(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const opt = normalized.value[highlightIndex.value];
    choose(opt);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
    triggerEl.value?.focus?.();
  }
}

function onDocPointer(e) {
  if (!open.value) return;
  const t = e.target;
  if (rootEl.value?.contains(t) || menuEl.value?.contains(t)) return;
  closeMenu();
}

function onWinChange() {
  if (open.value) placeMenu();
}

watch(
  () => props.modelValue,
  () => {
    if (open.value) syncHighlight();
  },
);

watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocPointer, true);
    window.addEventListener('resize', onWinChange);
    window.addEventListener('scroll', onWinChange, true);
  } else {
    document.removeEventListener('pointerdown', onDocPointer, true);
    window.removeEventListener('resize', onWinChange);
    window.removeEventListener('scroll', onWinChange, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  window.removeEventListener('resize', onWinChange);
  window.removeEventListener('scroll', onWinChange, true);
});
</script>

<style scoped>
.yz-select {
  position: relative;
  width: 100%;
  min-width: 0;
}
.yz-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(180deg, #eef2f1, #d3dcdf);
  color: var(--yz-metal-ink, #2a3a3e);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    inset -1px -1px 1px rgba(156, 170, 169, 0.5);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-align: left;
}
.yz-select-trigger:hover:not(:disabled) {
  filter: brightness(1.02);
}
.yz-select.open .yz-select-trigger,
.yz-select-trigger:focus-visible {
  border-color: var(--yz-accent, #5b8fa3);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.55),
    0 0 0 3px rgba(91, 143, 163, 0.2);
  outline: none;
}
.yz-select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.yz-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.yz-select-value.placeholder {
  color: var(--yz-metal-mute, #6a7d83);
  font-weight: 550;
}
.yz-select-chevron {
  flex: none;
  color: var(--yz-metal-mute, #6a7d83);
  font-size: 11px;
  transition: transform 0.2s ease;
}
.yz-select.open .yz-select-chevron {
  transform: rotate(180deg);
}
</style>

<!-- menu teleported: unscoped block for body portal -->
<style>
.yz-select-menu {
  overflow: auto;
  overscroll-behavior: contain;
  padding: 6px;
  border-radius: 14px;
  border: 1.5px solid var(--yz-rim, #c6ccca);
  background: linear-gradient(145deg, #eaefed, #95a7ae);
  box-shadow:
    -8px 0 14px rgba(255, 255, 255, 0.35),
    14px 0 28px rgba(2, 29, 37, 0.28),
    inset 1px 1px 2px rgba(255, 255, 255, 0.55);
  outline: none;
}
.yz-select-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--yz-metal-ink, #2a3a3e);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-align: left;
}
.yz-select-option .yz-opt-lamp {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
  background: var(--yz-lamp-off, #6a7d83);
}
.yz-select-option.highlight:not(.disabled) {
  background: linear-gradient(180deg, rgba(238, 242, 241, 0.85), rgba(183, 197, 202, 0.55));
  border-color: var(--yz-rim, #c6ccca);
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.45), inset -1px -1px 1px rgba(120, 140, 145, 0.35);
}
.yz-select-option.active {
  color: var(--yz-accent-strong, #3d6f82);
}
.yz-select-option.active .yz-opt-lamp {
  background: var(--yz-amber, #e3a560);
  box-shadow: 0 0 5px var(--yz-amber-glow, #f1b475), 0 0 8px rgba(227, 165, 96, 0.55);
}
.yz-select-option.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.yz-select-empty {
  padding: 10px;
  font-size: 12px;
  color: var(--yz-metal-mute, #6a7d83);
  text-align: center;
}
</style>
