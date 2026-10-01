<template>
  <div class="player-wrapper" v-if="currentSong">
    <Queue :open="showQueue" @close="showQueue = false" />

    <div class="player-bar">
      <div
        class="progress-bar-container"
        :class="{ 'no-seek': !canTransport }"
        ref="progressBarRef"
        @click="onProgressClick"
        @mousemove="onProgressHover"
        @mouseleave="progressTooltipVisible = false"
      >
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }" />
          <div class="progress-bar-thumb" :style="{ left: progressPercent + '%' }" />
        </div>
        <div
          v-if="progressTooltipVisible"
          class="progress-tooltip"
          :style="{ left: progressTooltipX + 'px' }"
        >
          {{ progressTooltipTime }}
        </div>
      </div>

      <button class="player-left" type="button" @click="toggleLyrics" title="打开歌词">
        <CoverArt :url="currentSong.coverUrl" :size="52" :radius="8" />
        <div class="song-info">
          <div class="song-name" :title="currentSong.name">{{ currentSong.name }}</div>
          <div class="song-artist">
            <span v-if="showBotBadge" class="bot-badge">{{ activeBot?.name }}</span>
            <span class="artist-name" :title="currentSong.artist">{{ currentSong.artist }}</span>
            <span v-if="platformLabel" class="platform-label">{{ platformLabel }}</span>
          </div>
        </div>
      </button>

      <div class="player-center">
        <div class="transport-row">
          <button v-if="canModeCtl" class="control-btn mode-btn" type="button" @click="cycleMode" :title="modeLabel">
            <Icon :icon="modeIcon" />
          </button>
          <button v-if="canControl" class="control-btn" type="button" @click="store.prev()" title="上一首">
            <Icon icon="mdi:skip-previous" />
          </button>
          <button v-if="canTransport" class="play-btn" type="button" @click="togglePlay" :title="store.isPlaying ? '暂停' : '播放'">
            <Icon :icon="store.isPlaying ? 'mdi:pause' : 'mdi:play'" />
          </button>
          <button v-if="canSkip" class="control-btn" type="button" @click="store.next()" title="下一首">
            <Icon icon="mdi:skip-next" />
          </button>
        </div>
        <div class="time-row">
          <span class="time-display">{{ formatTime(currentElapsed) }}</span>
          <span class="time-divider">/</span>
          <span class="time-display">{{ formatTime(currentSong?.duration ?? 0) }}</span>
        </div>
      </div>

      <div class="player-right">
        <div v-if="canTransport" class="volume-control">
          <Icon :icon="volumeIcon" class="volume-icon" />
          <input
            type="range"
            min="0"
            max="100"
            :value="volumeDisplay"
            @input="onVolumeInput"
            @change="onVolumeChange"
            @pointerup="onVolumeRelease"
            @pointercancel="onVolumeRelease"
            @blur="onVolumeRelease"
            class="volume-slider"
            title="音量"
          />
        </div>
        <button class="control-btn" type="button" :class="{ active: showQueue }" @click="showQueue = !showQueue" title="播放队列">
          <Icon icon="mdi:playlist-music" />
        </button>
        <button class="control-btn" type="button" :class="{ active: route.path === '/lyrics' }" @click="toggleLyrics" title="歌词">
          <Icon icon="mdi:microphone" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '../stores/player.js';
import { useSession } from '../composables/useSession.js';
import { useDecoupledSlider } from '../composables/useDecoupledSlider.js';
import CoverArt from './CoverArt.vue';
import Queue from './Queue.vue';

const route = useRoute();
const router = useRouter();
const showQueue = ref(false);

const { can, guestCan } = useSession();
const canControl = computed(() => can('player.control'));
const canTransport = computed(() => can('player.control') || guestCan('transport'));
const canSkip = computed(() => can('player.control') || guestCan('skip'));
const canModeCtl = computed(() => can('player.control') || guestCan('playMode'));

const store = usePlayerStore();
const activeBot = computed(() => store.activeBot);
const currentSong = computed(() => store.currentSong);
const showBotBadge = computed(() => store.bots.length > 1);
const platformLabels: Record<string, string> = {
  netease: '网易云',
  qq: 'QQ音乐',
  bilibili: 'B站',
  youtube: 'YouTube',
};
const platformLabel = computed(() => {
  const platform = currentSong.value?.platform;
  return platform ? platformLabels[platform] ?? platform : '';
});
const volumeIcon = computed(() => {
  const volume = activeBot.value?.volume ?? 75;
  if (volume <= 0) return 'mdi:volume-off';
  if (volume < 40) return 'mdi:volume-low';
  return 'mdi:volume-high';
});

function toggleLyrics() {
  if (route.path === '/lyrics') {
    // Go back if there's history, otherwise go home
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  } else {
    router.push('/lyrics');
  }
}

// Progress — use manual timer instead of relying on reactive getters
const currentElapsed = ref(0);
const progressPercent = ref(0);
const progressTooltipVisible = ref(false);
const progressTooltipX = ref(0);
const progressTooltipTime = ref('0:00');
const progressBarRef = ref<HTMLElement | null>(null);
let rafId: number | null = null;

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateProgress() {
  // liveElapsed() (an action, not the cached `elapsed` getter) re-interpolates
  // from the server anchor on every frame so the clock ticks each second (#107).
  currentElapsed.value = store.liveElapsed();

  const duration = currentSong.value?.duration ?? 0;
  progressPercent.value = duration > 0
    ? Math.min((currentElapsed.value / duration) * 100, 100)
    : 0;

  rafId = requestAnimationFrame(updateProgress);
}

async function onProgressClick(e: MouseEvent) {
  if (!canTransport.value) return; // seek gated on transport (canTransport)
  const bar = progressBarRef.value;
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const duration = currentSong.value?.duration ?? 0;
  const seekTime = ratio * duration;
  await store.seek(seekTime);
}

function onProgressHover(e: MouseEvent) {
  const bar = progressBarRef.value;
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const duration = currentSong.value?.duration ?? 0;
  progressTooltipVisible.value = true;
  progressTooltipX.value = e.clientX - rect.left;
  progressTooltipTime.value = formatTime(ratio * duration);
}

onMounted(() => {
  rafId = requestAnimationFrame(updateProgress);
});

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
});

function togglePlay() {
  if (store.isPlaying) {
    store.pause();
  } else {
    store.resume();
  }
}

// Volume slider is decoupled from the per-frame rAF re-render so dragging the
// thumb isn't reset every frame (#111). See useDecoupledSlider.
const {
  display: volumeDisplay,
  onInput: onVolumeInput,
  onChange: onVolumeChange,
  onRelease: onVolumeRelease,
} = useDecoupledSlider(
  () => activeBot.value?.volume,
  (v) => store.setVolume(v)
);

const modeOrder = ['seq', 'loop', 'random', 'rloop'] as const;
const modeIcons: Record<string, string> = {
  seq: 'mdi:arrow-right',
  loop: 'mdi:repeat',
  random: 'mdi:shuffle',
  rloop: 'mdi:shuffle-variant',
};
const modeLabels: Record<string, string> = {
  seq: '顺序',
  loop: '循环',
  random: '随机',
  rloop: '随机循环',
};

const currentMode = computed(() => activeBot.value?.playMode ?? 'seq');
const modeIcon = computed(() => modeIcons[currentMode.value] ?? modeIcons.seq);
const modeLabel = computed(() => modeLabels[currentMode.value] ?? modeLabels.seq);

function cycleMode() {
  const idx = modeOrder.indexOf(currentMode.value as typeof modeOrder[number]);
  const next = modeOrder[(idx + 1) % modeOrder.length];
  store.setMode(next);
}
</script>

<style lang="scss" scoped>
.player-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;

  @media (max-width: 768px) {
    display: none;
  }
}

.player-bar {
  height: var(--player-height);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 28px;
  background: color-mix(in srgb, var(--bg-navbar) 94%, #101010);
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, rgba(255, 255, 255, 0.12));
  box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.22);
  backdrop-filter: saturate(160%) blur(18px);
  -webkit-backdrop-filter: saturate(160%) blur(18px);
  position: relative;
}

.progress-bar-container {
  position: absolute;
  top: -7px;
  left: 0;
  right: 0;
  height: 14px;
  cursor: pointer;
  z-index: 101;
  display: flex;
  align-items: center;
  padding: 0;

  &:hover {
    .progress-bar-bg { height: 5px; }
    .progress-bar-thumb { opacity: 1; transform: scale(1); }
  }

  &.no-seek {
    cursor: default;
    &:hover {
      .progress-bar-bg { height: 2px; }
      .progress-bar-thumb { opacity: 0; transform: scale(0); }
    }
  }
}

.progress-bar-bg {
  width: 100%;
  height: 3px;
  background: color-mix(in srgb, var(--border-color) 70%, var(--text-tertiary));
  transition: height 0.15s ease;
  position: relative;
  border-radius: var(--radius-full);
}

.progress-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

.progress-bar-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  transform: scale(0);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  margin-left: -5px;
  margin-top: -5px;
}

.progress-tooltip {
  position: absolute;
  top: -30px;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
}

.time-display {
  font-size: var(--fs-2xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
}

.time-divider {
  color: var(--text-tertiary);
  font-size: var(--fs-2xs);
}

.player-left {
  display: flex;
  align-items: center;
  gap: 14px;
  width: min(34vw, 340px);
  min-width: 240px;
  height: 54px;
  padding: 0;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  min-inline-size: 0;
  transition: opacity var(--transition-fast), transform var(--transition-fast);

  &:hover {
    opacity: 0.88;
  }
}

.song-info {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.song-name {
  font-size: var(--fs-body);
  font-weight: var(--fw-semi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--lh-tight);
}

.song-artist {
  margin-top: 5px;
  font-size: var(--fs-2xs);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.artist-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.bot-badge {
  display: inline-block;
  font-size: var(--fs-micro);
  font-weight: var(--fw-semi);
  padding: 0 5px;
  background: var(--hover-bg);
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  line-height: 16px;
  white-space: nowrap;
  flex-shrink: 0;
}

.platform-label {
  flex: 0 0 auto;
  font-size: var(--fs-micro);
  color: var(--text-tertiary);
  line-height: 16px;
}

.player-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  min-width: 260px;
}

.transport-row {
  display: grid;
  grid-template-columns: 40px 40px 48px 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
}

.time-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 16px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  font-size: 21px;
  color: var(--text-secondary);
  opacity: 0.92;
  transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);

  &:hover {
    opacity: 1;
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  &.active {
    opacity: 1;
    color: var(--color-primary);
    background: var(--color-primary-10);
  }
}

.mode-btn {
  font-size: 19px;
}

.play-btn {
  width: 44px;
  height: 44px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
  box-shadow: 0 8px 18px var(--color-primary-15);
  transition: transform var(--transition-fast), filter var(--transition-fast);

  &:hover {
    filter: brightness(1.08);
    transform: scale(1.04);
  }

  &:active { transform: scale(0.95); }
}

.player-right {
  width: min(32vw, 320px);
  min-width: 236px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 150px;
}

.volume-icon {
  font-size: 18px;
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.volume-slider {
  width: 112px;
  height: 4px;
  appearance: none;
  background: color-mix(in srgb, var(--border-color) 80%, var(--text-tertiary));
  border-radius: var(--radius-full);
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 0 3px var(--color-primary-15);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 0;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
  }
}

@media (max-width: 1024px) {
  .player-bar {
    gap: 14px;
    padding-inline: 18px;
  }

  .player-left {
    min-width: 210px;
  }

  .player-right {
    min-width: 180px;
  }

  .volume-control {
    width: 116px;
  }

  .volume-slider {
    width: 78px;
  }
}
</style>
