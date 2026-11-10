<template>
  <div class="about-overlay" role="region" aria-label="关于">
    <button type="button" class="about-close" title="关闭，返回模型" @click="$emit('close')">×</button>

    <div class="about-layout">
      <div class="about-copy">
        <h2 class="about-title">{{ productName }}</h2>
        <p class="about-version">
          <span>版本 </span>
          <a
            class="about-link"
            :href="versionHref"
            :class="{ disabled: !hasVersionUrl }"
            :aria-disabled="!hasVersionUrl ? 'true' : undefined"
            :title="hasVersionUrl ? '打开版本相关页面' : '网址待接入'"
            @click="onVersionClick"
          >{{ productVersion }}</a>
        </p>

        <div class="about-meta">
          <div class="about-line">
            <span class="k">作者</span>
            <button
              type="button"
              class="v about-link about-link-btn"
              title="查看作者名片"
              @click="authorPreviewOpen = true"
            >{{ productAuthor }}</button>
          </div>
          <div class="about-line">
            <span class="k">仓库</span>
            <span class="v muted">{{ repoLabel }}</span>
          </div>
          <div class="about-line">
            <span class="k">致谢</span>
            <span class="v muted ack-text">{{ ackText }}</span>
          </div>
        </div>

        <div class="about-divider" aria-hidden="true" />

        <div class="about-intro">
          <p>
            <span class="hl">数字孪生</span>环境监测桌面端，基于
            <span class="hl">Electron</span> + <span class="hl">Vue3</span> +
            <span class="hl">Three.js</span> + <span class="hl">MQTT</span>。
          </p>
        </div>
      </div>

      <div class="about-card-col">
        <HoloCard :image-src="imageSrc" :name="cardName" />
        <p class="about-hint">移动指针可倾斜闪卡</p>
      </div>
    </div>

    <div
      v-if="authorPreviewOpen"
      class="author-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="作者名片"
      @click.self="authorPreviewOpen = false"
    >
      <div class="author-lightbox-panel">
        <button
          type="button"
          class="author-lightbox-close"
          title="关闭"
          @click="authorPreviewOpen = false"
        >×</button>
        <img class="author-lightbox-img" :src="authorImageSrc" alt="作者名片" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import HoloCard from './HoloCard.vue';
import {
  PRODUCT_NAME,
  PRODUCT_VERSION,
  VERSION_URL,
  AUTHOR_IMAGE_SRC,
  ACK_TEXT,
} from '../config.js';
import pkg from '../../package.json';

const props = defineProps({
  imageSrc: { type: String, default: './about/default-card.webp' },
  cardName: { type: String, default: '默认闪卡' },
  appMode: { type: String, default: 'demo' },
});
defineEmits(['close']);

const productName = PRODUCT_NAME || pkg.productName || pkg.name || '环境监测';
const productVersion = PRODUCT_VERSION || pkg.version || '—';
const productAuthor = pkg.author || '奶家人';
const repoLabel = '本地工程 · 环境监测';
const ackText = ACK_TEXT || '待编写';
const authorImageSrc = AUTHOR_IMAGE_SRC || './about/author.jpg';
const demoMode = computed(() => String(props.appMode || '').toLowerCase() === 'demo');

const versionUrl = String(VERSION_URL || '').trim();
const hasVersionUrl = /^https?:\/\//i.test(versionUrl);
const versionHref = hasVersionUrl ? versionUrl : '#';

const authorPreviewOpen = ref(false);

function onVersionClick(e) {
  if (!hasVersionUrl) {
    e.preventDefault();
    return;
  }
  // Electron / 桌面端：尽量交给系统浏览器
  e.preventDefault();
  try {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(versionUrl);
      return;
    }
  } catch (_) { /* ignore */ }
  window.open(versionUrl, '_blank', 'noopener,noreferrer');
}
</script>

<style scoped>
.about-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  border-radius: inherit;
  overflow: hidden;
  padding: 28px 32px 24px;
  background:
    radial-gradient(720px 420px at 78% 40%, rgba(56, 189, 248, 0.16), transparent 58%),
    radial-gradient(640px 380px at 18% 72%, rgba(167, 139, 250, 0.12), transparent 55%),
    linear-gradient(160deg, rgba(42, 48, 54, 0.96), rgba(28, 32, 36, 0.97));
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  border: 1.5px solid rgba(198, 204, 202, 0.35);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.12),
    inset -1px -1px 1px rgba(0, 0, 0, 0.25);
  color: #e8eef2;
}
.about-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 1.05fr) minmax(220px, 0.95fr);
  gap: 28px 36px;
  align-items: center;
}
.about-copy {
  max-width: 420px;
  padding-right: 8px;
}
.about-title {
  margin: 0 0 8px;
  font-size: clamp(28px, 3.2vw, 40px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #f8fafc;
  line-height: 1.1;
}
.about-version {
  margin: 0 0 16px;
  font-size: 14px;
  color: rgba(226, 232, 240, 0.78);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.about-link {
  color: #60a5fa;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 1px solid rgba(96, 165, 250, 0.45);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.about-link:hover {
  color: #93c5fd;
  border-bottom-color: rgba(147, 197, 253, 0.85);
}
.about-link.disabled {
  cursor: pointer;
  opacity: 0.95;
}
.about-link-btn {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(96, 165, 250, 0.45);
  padding: 0;
  margin: 0;
  font: inherit;
  line-height: inherit;
}
.about-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #ecfeff;
  background: rgba(34, 211, 238, 0.28);
  border: 1px solid rgba(34, 211, 238, 0.5);
}
.about-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.about-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  align-items: baseline;
}
.about-line .k {
  color: rgba(148, 163, 184, 0.95);
  font-weight: 600;
}
.about-line .v {
  color: #f1f5f9;
  font-weight: 650;
  text-align: right;
}
.about-line .v.muted {
  color: rgba(203, 213, 225, 0.85);
  font-weight: 600;
}
.about-line .v.ack-text {
  white-space: pre-line;
  max-width: 70%;
}
.about-divider {
  height: 1px;
  margin: 4px 0 14px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.45), transparent);
}
.about-intro p {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.88);
}
.about-intro .hl {
  display: inline;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 700;
  color: #ecfeff;
  background: rgba(34, 211, 238, 0.22);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.about-card-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-width: 0;
}
.about-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.65);
  letter-spacing: 0.02em;
}
.about-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid #c6ccca;
  background: linear-gradient(90deg, #eef2f1, #b7c5ca);
  color: #2a3a3e;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5);
  z-index: 2;
}
.about-close:hover {
  filter: brightness(1.05);
}

.author-lightbox {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 12, 18, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.author-lightbox-panel {
  position: relative;
  max-width: min(420px, 92%);
  max-height: min(720px, 92%);
  border-radius: 16px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}
.author-lightbox-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(720px, 88vh);
  object-fit: contain;
  background: #fff;
}
.author-lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}
.author-lightbox-close:hover {
  filter: brightness(1.1);
}

@media (max-width: 980px) {
  .about-layout {
    grid-template-columns: 1fr;
    gap: 18px;
    overflow: auto;
  }
  .about-copy {
    max-width: none;
  }
}
</style>
