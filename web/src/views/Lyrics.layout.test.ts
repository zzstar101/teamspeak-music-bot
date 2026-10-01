import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("Lyrics layout", () => {
  it("centers the song card in the left column", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");
    const leftRule = source.match(/\.lyrics-left\s*\{(?<body>[\s\S]*?)\n\}/);

    expect(leftRule?.groups?.body).toContain("justify-content: center");
  });

  it("drives lyric sync with animation frames instead of interval polling", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("requestAnimationFrame");
    expect(source).not.toContain("setInterval(syncLyrics");
  });

  it("seeks playback when a lyric line is selected", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("store.seek");
  });

  it("uses a real scroll container so users can browse lyric lines", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("overflow-y: auto");
    expect(source).toContain("scrollTo");
  });

  it("hides scrollbars while keeping the lyric list scrollable", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("scrollbar-width: none");
    expect(source).toContain("::-webkit-scrollbar");
    expect(source).toContain("display: none");
  });

  it("shows a center selection bar for manual lyric seeking", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("lyrics-position-overlay");
    expect(source).toContain("position: absolute");
    expect(source).toContain("top: 50%");
    expect(source).toContain("manualTargetLine");
    expect(source).toContain("seekToLine(manualTargetLine)");
  });

  it("renders the manual seek center line as a lyrics panel overlay outside the scroll container", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8").replace(/\r\n/g, "\n");

    expect(source).toContain('class="lyrics-stage"');
    expect(source).toContain(".lyrics-stage");
    expect(source).toContain('\n          </div>\n          <div v-if="manualSeeking" class="lyrics-position-overlay">');
    expect(source).not.toContain('\n        </div>\n        <div v-if="manualSeeking" class="lyrics-position-overlay">');
  });

  it("keeps the center selection bar visible for 2 seconds after manual scrolling stops", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("MANUAL_SEEK_IDLE_MS = 2000");
    expect(source).not.toContain("}, 1800)");
  });

  it("returns to the active lyric line after manual scrolling becomes idle", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("resumeAutoFollow");
    expect(source).toContain("scrollToActiveLine(activeLine.value");
  });

  it("centers active lyric changes without smooth-scroll lag", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("scrollToActiveLine(idx, 'auto')");
    expect(source).not.toContain("function scrollToActiveLine(idx: number) {\n  if (manualSeeking.value) return;");
  });

  it("centers the currently playing lyric line after lyrics load", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("centerInitialLyric");
    expect(source).toContain("await nextTick()");
    expect(source).toContain("await waitForLayoutFrame()");
    expect(source).toContain("getInitialLyricLineIndex");
    expect(source).toContain("currentElapsed.value = store.liveElapsed()");
    expect(source).toContain("scrollToLine(initialLine");
    expect(source).not.toContain("activeLine.value = lines.value.length > 0 ? 0 : -1");
  });

  it("sizes lyric edge padding from the scroll container so first and last lines can reach center", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("updateLyricsEdgePadding");
    expect(source).toContain("--lyrics-edge-padding");
    expect(source).not.toContain("height: 40%");
  });

  it("reserves bottom-player space on mobile lyrics layout", () => {
    const mobileSource = readFileSync(join(currentDir, "../styles/mobile.scss"), "utf8");

    expect(mobileSource).toContain(".lyrics-content");
    expect(mobileSource).toContain("padding: calc(56px + env(safe-area-inset-top)) 18px calc(var(--player-height) + 18px)");
  });

  it("loads lyrics by stable song identity instead of currentSong object reference", () => {
    const source = readFileSync(join(currentDir, "Lyrics.vue"), "utf8");

    expect(source).toContain("currentSongKey");
    expect(source).toContain("getLyricsSongKey(currentSong.value)");
    expect(source).toContain("watch(currentSongKey");
    expect(source).not.toContain("watch(currentSong,");
  });
});
