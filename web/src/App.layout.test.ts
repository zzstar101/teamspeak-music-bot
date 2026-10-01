import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("App layout", () => {
  it("keeps bottom players and mobile navigation available on the lyrics page", () => {
    const source = readFileSync(join(currentDir, "App.vue"), "utf8");

    expect(source).toContain("<Player />");
    expect(source).toContain('v-if="currentSong"');
    expect(source).toContain('<nav class="m-tabbar">');
    expect(source).not.toContain("isLyricsRoute");
  });

  it("shows current and total duration in the mobile mini player", () => {
    const source = readFileSync(join(currentDir, "App.vue"), "utf8");

    expect(source).toContain('class="m-player-time-row"');
    expect(source).toContain('class="m-player-time m-player-time-current"');
    expect(source).toContain('class="m-player-time m-player-time-duration"');
    expect(source).toContain("mobileElapsedLabel");
    expect(source).toContain("mobileDurationLabel");
  });
});
