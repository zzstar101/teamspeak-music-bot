<template>
  <div class="lyrics-page" :style="bgStyle">
    <div class="lyrics-overlay" />
    <button class="back-btn" @click="goBack">
      <Icon icon="mdi:arrow-left" />
      返回
    </button>

    <div v-if="currentSong" class="lyrics-content">
      <div class="lyrics-left">
        <CoverArt :url="currentSong.coverUrl" :size="280" :radius="14" :show-shadow="true" />
        <div class="song-meta">
          <div class="song-name">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
      </div>

      <div class="lyrics-right">
        <div class="lyrics-options">
          <button
            class="lyrics-option"
            :class="{ active: displayOptions.translation }"
            type="button"
            @click="toggleOption('translation')"
          >
            译文
          </button>
          <button
            class="lyrics-option"
            :class="{ active: displayOptions.romanization }"
            type="button"
            @click="toggleOption('romanization')"
          >
            音译
          </button>
          <button
            class="lyrics-option"
            :class="{ active: displayOptions.wordTiming }"
            type="button"
            @click="toggleOption('wordTiming')"
          >
            逐字
          </button>
        </div>
        <div v-if="loading" class="lyrics-loading">加载歌词中...</div>
        <div v-else-if="lines.length === 0" class="lyrics-empty">暂无歌词</div>
        <div v-else class="lyrics-stage">
          <div
            class="lyrics-scroll"
            ref="scrollContainer"
            @scroll="onLyricsScroll"
          >
            <div class="lyrics-inner">
              <div class="lyrics-spacer" />
              <div
                v-for="(line, i) in lines"
                :key="i"
                :ref="el => { if (el) lineRefs[i] = el as HTMLElement }"
                class="lyrics-line"
                :class="{ active: i === activeLine, 'manual-target': i === manualTargetLine && manualSeeking }"
                @click="seekToLine(i)"
              >
                <div class="lyrics-text">
                  <template v-if="displayOptions.wordTiming && line.words?.length">
                    <span
                      v-for="(word, wordIndex) in line.words"
                      :key="`${i}-${wordIndex}`"
                      class="lyrics-word"
                      :class="{ active: i === activeLine && wordIndex <= activeWordIndex }"
                      :style="{ '--lyrics-word-progress': formatWordProgress(word) }"
                    >
                      {{ word.text }}
                    </span>
                  </template>
                  <template v-else>{{ line.text }}</template>
                </div>
                <div v-if="displayOptions.translation && line.translation" class="lyrics-translation">
                  {{ line.translation }}
                </div>
                <div v-if="displayOptions.romanization && line.romanization" class="lyrics-romanization">
                  {{ line.romanization }}
                </div>
              </div>
              <div class="lyrics-spacer" />
            </div>
          </div>
          <div v-if="manualSeeking" class="lyrics-position-overlay">
            <div class="lyrics-position-dash" />
            <button
              class="lyrics-position-play"
              type="button"
              :disabled="manualTargetLine < 0"
              @click.stop="seekToLine(manualTargetLine)"
            >
              <Icon icon="mdi:play" />
              <span>{{ manualTargetTimeLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-song">
      当前没有正在播放的歌曲
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { usePlayerStore } from '../stores/player.js';
import { useSession } from '../composables/useSession.js';
import CoverArt from '../components/CoverArt.vue';
import {
  findActiveLine,
  getActiveWordIndex,
  getInitialLyricLineIndex,
  getLyricsSongKey,
  getWordProgress,
  normalizeLyricsOptions,
  type LyricLine,
  type LyricWord,
  type LyricsDisplayOptions,
} from './lyrics-utils.js';

const router = useRouter();
const store = usePlayerStore();
const { can, guestCan } = useSession();
const currentSong = computed(() => store.currentSong);
const currentSongKey = computed(() => getLyricsSongKey(currentSong.value));
const canSeek = computed(() => can('player.control') || guestCan('transport'));

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}

const lines = ref<LyricLine[]>([]);
const activeLine = ref(-1);
const currentElapsed = ref(0);
const loading = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);
const lineRefs = ref<Record<number, HTMLElement>>({});
const manualSeeking = ref(false);
const manualTargetLine = ref(-1);
const displayOptions = ref(loadDisplayOptions());
let syncRaf: number | null = null;
let manualSeekingTimer: ReturnType<typeof setTimeout> | null = null;
let autoScrollTimer: ReturnType<typeof setTimeout> | null = null;
let isAutoScrolling = false;
const MANUAL_SEEK_IDLE_MS = 2000;

const activeWordIndex = computed(() => (
  displayOptions.value.wordTiming
    ? getActiveWordIndex(lines.value[activeLine.value], currentElapsed.value)
    : -1
));

const bgStyle = computed(() => {
  if (currentSong.value?.coverUrl) {
    return {
      backgroundImage: `url(${currentSong.value.coverUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {};
});

const manualTargetTimeLabel = computed(() => formatTime(lines.value[manualTargetLine.value]?.time ?? 0));

function loadDisplayOptions(): LyricsDisplayOptions {
  try {
    const raw = localStorage.getItem('lyrics-display-options');
    return normalizeLyricsOptions(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeLyricsOptions(null);
  }
}

function persistDisplayOptions() {
  localStorage.setItem('lyrics-display-options', JSON.stringify(displayOptions.value));
}

function toggleOption(option: keyof LyricsDisplayOptions) {
  displayOptions.value = {
    ...displayOptions.value,
    [option]: !displayOptions.value[option],
  };
  persistDisplayOptions();
}

function formatWordProgress(word: LyricWord): string {
  return `${Math.round(getWordProgress(word, currentElapsed.value) * 100)}%`;
}

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

async function fetchLyrics() {
  if (!currentSong.value) return;
  loading.value = true;
  lines.value = [];
  activeLine.value = -1;

  try {
    const res = await axios.get(`/api/music/lyrics/${currentSong.value.id}`, {
      params: { platform: currentSong.value.platform },
    });
    lines.value = res.data.lyrics || [];
  } catch {
    lines.value = [];
  } finally {
    loading.value = false;
  }
  if (lines.value.length > 0) await centerInitialLyric();
}

function scrollToLine(idx: number, behavior: ScrollBehavior = 'smooth') {
  const el = lineRefs.value[idx];
  const container = scrollContainer.value;
  if (!el || !container) return;

  const containerHeight = container.clientHeight;
  const lineTop = el.offsetTop;
  const lineHeight = el.offsetHeight;
  const targetTop = Math.max(0, lineTop - containerHeight / 2 + lineHeight / 2);
  isAutoScrolling = true;
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
  autoScrollTimer = setTimeout(() => {
    isAutoScrolling = false;
  }, behavior === 'smooth' ? 520 : 80);
  container.scrollTo({ top: targetTop, behavior });
}

function scrollToActiveLine(idx: number, behavior: ScrollBehavior = 'auto') {
  scrollToLine(idx, behavior);
}

function waitForLayoutFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

function updateLyricsEdgePadding() {
  const container = scrollContainer.value;
  if (!container) return;
  container.style.setProperty('--lyrics-edge-padding', `${Math.max(0, container.clientHeight / 2)}px`);
}

async function centerInitialLyric() {
  await nextTick();
  currentElapsed.value = store.liveElapsed();
  const initialLine = getInitialLyricLineIndex(lines.value, currentElapsed.value);
  activeLine.value = initialLine;
  await waitForLayoutFrame();
  await waitForLayoutFrame();
  updateLyricsEdgePadding();
  if (initialLine >= 0) scrollToLine(initialLine, 'auto');
}

function findManualTargetLine(): number {
  const container = scrollContainer.value;
  if (!container) return -1;
  const center = container.scrollTop + container.clientHeight / 2;
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [rawIndex, el] of Object.entries(lineRefs.value)) {
    const index = Number(rawIndex);
    const lineCenter = el.offsetTop + el.offsetHeight / 2;
    const distance = Math.abs(lineCenter - center);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

function onLyricsScroll() {
  if (isAutoScrolling) return;
  manualSeeking.value = true;
  manualTargetLine.value = findManualTargetLine();
  if (manualSeekingTimer) clearTimeout(manualSeekingTimer);
  manualSeekingTimer = setTimeout(resumeAutoFollow, MANUAL_SEEK_IDLE_MS);
}

function resumeAutoFollow() {
  manualSeeking.value = false;
  manualTargetLine.value = -1;
  if (activeLine.value >= 0) {
    scrollToActiveLine(activeLine.value, 'auto');
  }
}

function syncLyrics() {
  currentElapsed.value = store.liveElapsed();
  if (lines.value.length === 0) return;
  const idx = findActiveLine(lines.value, currentElapsed.value);
  if (idx !== activeLine.value && idx >= 0) {
    activeLine.value = idx;
    if (!manualSeeking.value) {
      scrollToActiveLine(idx, 'auto');
    }
  }
}

async function seekToLine(index: number) {
  const line = lines.value[index];
  if (!line) return;
  manualSeeking.value = false;
  activeLine.value = index;
  scrollToLine(index);
  if (canSeek.value) {
    await store.seek(line.time);
  }
}

function startSync() {
  stopSync();
  const tick = () => {
    syncLyrics();
    syncRaf = requestAnimationFrame(tick);
  };
  syncRaf = requestAnimationFrame(tick);
}

function stopSync() {
  if (syncRaf !== null) {
    cancelAnimationFrame(syncRaf);
    syncRaf = null;
  }
}

watch(currentSongKey, () => {
  lineRefs.value = {};
  fetchLyrics();
});

onMounted(() => {
  if (currentSong.value) fetchLyrics();
  window.addEventListener('resize', updateLyricsEdgePadding);
  startSync();
});

onUnmounted(() => {
  stopSync();
  window.removeEventListener('resize', updateLyricsEdgePadding);
  if (manualSeekingTimer) clearTimeout(manualSeekingTimer);
  if (autoScrollTimer) clearTimeout(autoScrollTimer);
});
</script>

<style lang="scss" scoped>
.lyrics-page {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(60px);
  -webkit-backdrop-filter: blur(60px);
}

.back-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  transition: color var(--transition-fast);
  &:hover { color: white; }
}

.lyrics-content {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 60px;
  max-width: 1000px;
  width: 100%;
  padding: 40px;
  height: 80vh;
}

.lyrics-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 320px;
  flex-shrink: 0;
}

.song-meta {
  text-align: center;
}

.song-name {
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.lyrics-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  position: relative;
}

.lyrics-options {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  flex: 0 0 auto;
}

.lyrics-option {
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.55);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semi);
  background: rgba(255, 255, 255, 0.04);
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);

  &:hover,
  &.active {
    color: white;
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.12);
  }
}

.lyrics-stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.lyrics-scroll {
  --lyrics-edge-padding: 0px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  mask-image: linear-gradient(
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.lyrics-inner {
  min-height: 100%;
}

.lyrics-scroll::-webkit-scrollbar {
  display: none;
}

.lyrics-spacer {
  height: var(--lyrics-edge-padding);
}

.lyrics-line {
  padding: 8px 0;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);

  .lyrics-text {
    font-size: 18px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.3);
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .lyrics-translation {
    font-size: 14px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.15);
    margin-top: 2px;
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  &.active {
    .lyrics-text {
      font-size: 22px;
      font-weight: 600;
      color: white;
    }
    .lyrics-translation {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  &:hover:not(.active) {
    .lyrics-text {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  &.manual-target:not(.active) {
    .lyrics-text {
      color: rgba(255, 255, 255, 0.72);
    }
  }
}

.lyrics-word {
  --lyrics-word-progress: 0%;
  color: rgba(255, 255, 255, 0.38);
  background: linear-gradient(
    90deg,
    white var(--lyrics-word-progress),
    currentColor var(--lyrics-word-progress)
  );
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: background 0.12s linear;

  &.active {
    color: rgba(255, 255, 255, 0.38);
  }
}

.lyrics-romanization {
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.22);
  margin-top: 2px;
}

.lyrics-position-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  transform: translateY(-50%);
  pointer-events: none;
}

.lyrics-position-dash {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.42),
    rgba(255, 255, 255, 0.08)
  );
}

.lyrics-position-play {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  color: white;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: var(--fs-2xs);
  font-variant-numeric: tabular-nums;
  pointer-events: auto;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.lyrics-loading,
.lyrics-empty {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  text-align: center;
  padding: 60px 0;
}

.no-song {
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
}
</style>
