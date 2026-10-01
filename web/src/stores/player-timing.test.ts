import { describe, expect, it } from "vitest";
import { calculateElapsed } from "./player.js";

describe("calculateElapsed", () => {
  it("advances between server syncs while playback is active", () => {
    expect(
      calculateElapsed({
        serverElapsed: 12,
        serverSyncTime: 1_000,
        wasPlaying: true,
        paused: false,
        duration: 120,
        now: 3_500,
      }),
    ).toBe(14.5);
  });

  it("freezes at server elapsed while paused", () => {
    expect(
      calculateElapsed({
        serverElapsed: 42,
        serverSyncTime: 1_000,
        wasPlaying: true,
        paused: true,
        duration: 120,
        now: 9_000,
      }),
    ).toBe(42);
  });

  it("caps interpolated elapsed at the song duration", () => {
    expect(
      calculateElapsed({
        serverElapsed: 118,
        serverSyncTime: 1_000,
        wasPlaying: true,
        paused: false,
        duration: 120,
        now: 6_000,
      }),
    ).toBe(120);
  });
});
