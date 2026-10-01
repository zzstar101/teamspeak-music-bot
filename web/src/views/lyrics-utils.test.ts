import { describe, expect, it } from "vitest";
import {
  findActiveLine,
  getActiveWordIndex,
  getInitialLyricLineIndex,
  getLyricsSongKey,
  getWordProgress,
  normalizeLyricsOptions,
} from "./lyrics-utils.js";

describe("lyrics utilities", () => {
  it("finds the latest lyric line at or before elapsed time", () => {
    expect(findActiveLine([
      { time: 1, text: "a" },
      { time: 3, text: "b" },
      { time: 5, text: "c" },
    ], 3.2)).toBe(1);
  });

  it("chooses the currently playing line when the lyrics view first opens", () => {
    const lines = [
      { time: 1, text: "a" },
      { time: 3, text: "b" },
      { time: 5, text: "c" },
    ];

    expect(getInitialLyricLineIndex(lines, 3.2)).toBe(1);
    expect(getInitialLyricLineIndex(lines, 0.2)).toBe(0);
    expect(getInitialLyricLineIndex([], 3.2)).toBe(-1);
  });

  it("finds the active word inside a word-timed line", () => {
    expect(getActiveWordIndex({
      time: 10,
      text: "LOVE 2000",
      words: [
        { start: 10, duration: 0.5, text: "LOVE" },
        { start: 10.5, duration: 1, text: " 2000" },
      ],
    }, 10.6)).toBe(1);
  });

  it("calculates per-word karaoke progress", () => {
    expect(getWordProgress({ start: 10, duration: 2, text: "LOVE" }, 9)).toBe(0);
    expect(getWordProgress({ start: 10, duration: 2, text: "LOVE" }, 11)).toBe(0.5);
    expect(getWordProgress({ start: 10, duration: 2, text: "LOVE" }, 13)).toBe(1);
  });

  it("normalizes missing display options", () => {
    expect(normalizeLyricsOptions({ romanization: true })).toEqual({
      translation: true,
      romanization: true,
      wordTiming: true,
    });
  });

  it("keeps the same lyrics key for cloned song identity status updates", () => {
    const before = { id: "1842025914", platform: "netease", name: "LOVE 2000", volume: 45 };
    const afterVolumeChange = { ...before, volume: 80 };

    expect(getLyricsSongKey(before)).toBe(getLyricsSongKey(afterVolumeChange));
    expect(getLyricsSongKey(before)).not.toBe(getLyricsSongKey({ ...before, id: "1842025915" }));
    expect(getLyricsSongKey(before)).not.toBe(getLyricsSongKey({ ...before, platform: "qq" }));
  });
});
